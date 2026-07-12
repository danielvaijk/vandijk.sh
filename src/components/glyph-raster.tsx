import {
  type QwikJSX,
  type TaskCtx,
  component$,
  useId,
  useStylesScoped$,
  useVisibleTask$,
} from "@builder.io/qwik";

import styles from "src/components/glyph-raster.css?inline";

import {
  DEFAULT_FRAME_RATE,
  DOCUMENT_ANCHOR_EDGE_MARGIN,
  DOCUMENT_ANCHOR_OVERSCAN,
  GLYPH_CHARS,
  type GlyphRasterLayout,
  type GlyphRasterPreset,
  MAX_FRAME_RATE,
  MAX_GLYPH_GRID_CELLS,
  MIN_FRAME_RATE,
  PROCEDURAL_ENTROPY_SAMPLE_RATE,
  PROCEDURAL_VISUAL_SAMPLE_RATE,
  easeEntropyRate,
  entropyRateForBrightness,
  quantizeTime,
  resolveGlyphGrid,
  resolvePreset,
  shiftGridRows,
  shouldRefreshCharacter,
} from "src/vfx/glyph-raster/logic";
import { clamp } from "src/vfx/shared/math";
import {
  FIELD_MODIFIER_SAMPLE_SIZE,
  type GlyphFieldModifierRegion as FieldGlyphFieldModifierRegion,
  applyGlyphFieldModifierBrightness,
} from "src/vfx/glyph-raster/field";
import { type GlyphEntropyMode, createWebGlGlyphRenderer } from "src/vfx/glyph-raster/webgl";
import { noiseVisualBrightness } from "src/vfx/solar-noise/cpu";
import {
  type GlyphRasterSource,
  createFrameModifierBrightnessGrids,
  createNoiseAdapter,
  resolveSource,
} from "src/vfx/glyph-raster/source";
import {
  type ActiveGlyphRaster,
  addActiveGlyphRaster,
  removeActiveGlyphRaster,
  scheduleActiveGlyphRasters,
} from "src/vfx/shared/animation-loop";

export type {
  GlyphRasterFrameSource,
  GlyphRasterNoiseSource,
  GlyphRasterSource,
} from "src/vfx/glyph-raster/source";

type GlyphRasterFrameFit = "contain" | "cover";
type GlyphRasterAnchor = "auto" | "document" | "viewport";

export interface GlyphRasterProps {
  blend?: number;
  class?: string;
  frameFit?: GlyphRasterFrameFit;
  anchor?: GlyphRasterAnchor;
  layout?: GlyphRasterLayout;
  opacity?: number;
  source?: GlyphRasterSource;
}

type GlyphFieldModifierRegion = FieldGlyphFieldModifierRegion & {
  baseBlend: number;
  blend: number;
  brightnessGrid?: Uint8Array;
  documentLeft: number;
  documentTop: number;
  element: HTMLElement;
  height: number;
  width: number;
};

const glyphFieldModifierRegions = new Map<string, GlyphFieldModifierRegion>();
let glyphFieldModifierRegionsVersion = 0;

const readCssLength = (name: string, fallback: number): number => {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  if (!value) {
    return fallback;
  }

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.width = value;
  root.append(probe);

  const resolved = probe.getBoundingClientRect().width;
  probe.remove();

  return Number.isFinite(resolved) && resolved > 0 ? resolved : fallback;
};

const readLargeViewportHeight = (): number => {
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = "100lvh";
  document.documentElement.append(probe);

  const { height } = probe.getBoundingClientRect();
  probe.remove();

  return height > 0 ? height : window.innerHeight;
};

const resolveRuntimePreset = (preset: GlyphRasterPreset): GlyphRasterPreset => ({
  backgroundColor: preset.backgroundColor,
  cellHeight: readCssLength("--glyph-cell-height", preset.cellHeight),
  cellWidth: readCssLength("--glyph-cell-width", preset.cellWidth),
  colors: preset.colors,
  fontSize: readCssLength("--glyph-font-size", preset.fontSize),
  layout: preset.layout,
});

const markGlyphFieldModifierRegionsChanged = (): void => {
  glyphFieldModifierRegionsVersion += 1;
};

const updateGlyphFieldModifierRegionBounds = (
  region: GlyphFieldModifierRegion,
  shouldMarkChanged = true,
): void => {
  const rect = region.element.getBoundingClientRect();

  region.documentLeft = rect.left + window.scrollX;
  region.documentTop = rect.top + window.scrollY;
  region.width = rect.width;
  region.height = rect.height;
  if (shouldMarkChanged) {
    markGlyphFieldModifierRegionsChanged();
  }
};

const updateGlyphFieldModifierRegionBlend = (region: GlyphFieldModifierRegion): boolean => {
  const opacity = Number(getComputedStyle(region.element).opacity);
  const nextBlend = region.baseBlend * (Number.isFinite(opacity) ? clamp(opacity, 0, 1) : 1);

  if (Math.abs(region.blend - nextBlend) <= 0.001) {
    return false;
  }

  region.blend = nextBlend;
  markGlyphFieldModifierRegionsChanged();
  return true;
};

export const GlyphRaster = component$(
  ({
    anchor = "auto",
    blend,
    class: className,
    frameFit = "contain",
    layout,
    opacity,
    source,
  }: GlyphRasterProps): QwikJSX.Element => {
    const rasterId = useId();
    const resolvedSource = resolveSource(source);
    const preset = resolvePreset(resolvedSource, layout);
    const modifierBlend = clamp(blend ?? 1, 0, 1);
    const visualRange = resolvedSource.type === "procedural-noise" ? clamp(opacity ?? 1, 0, 1) : 1;
    const resolvedCharacters = [...new Set(GLYPH_CHARS)];
    const style = `--glyph-raster-color: ${preset.backgroundColor};`;
    const classes = className ? `${className} ` : "";

    useStylesScoped$(styles);

    useVisibleTask$(({ cleanup }: TaskCtx) => {
      let isDocumentVisible = document.visibilityState === "visible";
      let isCleanedUp = false;
      let isRasterVisible = preset.layout === "fixed";
      let activeRaster: ActiveGlyphRaster | null = null;
      let removeResize = (): void => {
        /* Empty */
      };
      let removeBlendObserver = (): void => {
        /* Empty */
      };
      let removeVisibilityListener = (): void => {
        /* Empty */
      };
      let removeVisibilityObserver = (): void => {
        /* Empty */
      };
      const runtimePreset = resolveRuntimePreset(preset);

      cleanup(() => {
        isCleanedUp = true;
        if (activeRaster) {
          removeActiveGlyphRaster(activeRaster);
        }
        removeResize();
        removeBlendObserver();
        removeVisibilityListener();
        removeVisibilityObserver();
      });

      if (resolvedSource.type === "frames") {
        const element = document.querySelector(`#${rasterId}`) as HTMLElement | null;
        if (!element) {
          return;
        }

        let frameAspectRatio = 0;
        const readFrameFitBounds = (): {
          height: number;
          left: number;
          top: number;
          width: number;
        } | null => {
          if (preset.layout === "fixed") {
            const viewport = window.visualViewport;

            if (!viewport) {
              return {
                height: window.innerHeight,
                left: 0,
                top: 0,
                width: window.innerWidth,
              };
            }

            return {
              height: viewport.height,
              left: viewport.offsetLeft,
              top: viewport.offsetTop,
              width: viewport.width,
            };
          }

          const parent = element.parentElement;
          const parentBounds = parent ? parent.getBoundingClientRect() : null;
          if (!parentBounds) {
            return null;
          }

          return {
            height: parentBounds.height,
            left: 0,
            top: 0,
            width: parentBounds.width,
          };
        };

        const applyFrameFit = (): void => {
          if (frameAspectRatio <= 0 || (preset.layout === "fill" && frameFit !== "cover")) {
            return;
          }

          const bounds = readFrameFitBounds();

          if (!bounds || bounds.height <= 0 || bounds.width <= 0) {
            return;
          }

          const fitWidth =
            frameFit === "cover"
              ? Math.max(bounds.width, bounds.height * frameAspectRatio)
              : Math.min(bounds.width, bounds.height * frameAspectRatio);
          const fitHeight = fitWidth / frameAspectRatio;

          element.style.width = `${fitWidth}px`;
          element.style.height = `${fitHeight}px`;
          element.style.left = `${bounds.left + bounds.width / 2}px`;
          element.style.top = `${bounds.top + bounds.height / 2}px`;
          element.style.transform = "translate(-50%, -50%)";

          if (preset.layout === "fill") {
            element.style.right = "auto";
            element.style.bottom = "auto";
            return;
          }
        };

        const region: GlyphFieldModifierRegion = {
          baseBlend: modifierBlend,
          blend: modifierBlend,
          documentLeft: 0,
          documentTop: 0,
          element,
          height: 0,
          width: 0,
        };
        const onRegionChanged = (): void => {
          applyFrameFit();
          updateGlyphFieldModifierRegionBounds(region);
          scheduleActiveGlyphRasters();
        };
        const onRegionBlendChanged = (): void => {
          if (updateGlyphFieldModifierRegionBlend(region)) {
            scheduleActiveGlyphRasters();
          }
        };
        const resizeObserver = new ResizeObserver(onRegionChanged);
        const onWindowChanged = (): void => onRegionChanged();
        const onNextFrame = (): void => {
          animationFrame = 0;
          onRegionChanged();
        };
        const onRegionBlendTransitionFrame = (): void => {
          blendAnimationFrame = 0;
          onRegionBlendChanged();

          if (
            !isCleanedUp &&
            element.getAnimations().some((animation) => animation.playState === "running")
          ) {
            blendAnimationFrame = requestAnimationFrame(onRegionBlendTransitionFrame);
          }
        };
        const onRegionBlendTransitionChanged = (): void => {
          onRegionBlendChanged();

          if (blendAnimationFrame === 0) {
            blendAnimationFrame = requestAnimationFrame(onRegionBlendTransitionFrame);
          }
        };
        let animationFrame = 0;
        let blendAnimationFrame = 0;

        glyphFieldModifierRegions.set(rasterId, region);
        onRegionChanged();
        onRegionBlendChanged();
        createFrameModifierBrightnessGrids(resolvedSource)
          .then(({ aspectRatio, defaultFps, frameCount, grids }) => {
            if (isCleanedUp) {
              return;
            }

            frameAspectRatio = aspectRatio;
            element.style.setProperty("--glyph-raster-frame-aspect", String(aspectRatio));
            onRegionChanged();

            const frameSize = FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;
            const frameRate = clamp(defaultFps, MIN_FRAME_RATE, MAX_FRAME_RATE);
            region.brightnessGrid = grids.subarray(0, frameSize);
            markGlyphFieldModifierRegionsChanged();
            scheduleActiveGlyphRasters();

            if (frameCount <= 1) {
              return;
            }

            let framePosition = 0;
            let lastFrameAt = 0;

            activeRaster = {
              canRender: () => isDocumentVisible && isRasterVisible,
              render: (time: number): void => {
                if (lastFrameAt !== 0 && time - lastFrameAt < 1000 / frameRate) {
                  return;
                }

                const elapsedMilliseconds =
                  lastFrameAt === 0 ? 1000 / frameRate : time - lastFrameAt;
                const elapsedFrames = (elapsedMilliseconds / 1000) * frameRate;
                const currentFrame = Math.floor(framePosition) % frameCount;
                const frameOffset = currentFrame * frameSize;

                region.brightnessGrid = grids.subarray(frameOffset, frameOffset + frameSize);
                markGlyphFieldModifierRegionsChanged();
                framePosition = (framePosition + elapsedFrames) % frameCount;
                lastFrameAt = time;
              },
            };
            addActiveGlyphRaster(activeRaster);
            scheduleActiveGlyphRasters();
          })
          .catch(() => {
            /* Empty */
          });
        animationFrame = requestAnimationFrame(onNextFrame);
        resizeObserver.observe(element);
        window.addEventListener("load", onWindowChanged);
        window.addEventListener("resize", onWindowChanged);
        const { visualViewport } = globalThis;
        if (visualViewport) {
          visualViewport.addEventListener("resize", onWindowChanged);
          visualViewport.addEventListener("scroll", onWindowChanged);
        }
        element.addEventListener("transitionrun", onRegionBlendTransitionChanged);
        element.addEventListener("transitionend", onRegionBlendTransitionChanged);
        element.addEventListener("transitioncancel", onRegionBlendTransitionChanged);

        removeResize = () => {
          if (animationFrame !== 0) {
            cancelAnimationFrame(animationFrame);
          }
          resizeObserver.disconnect();
          window.removeEventListener("load", onWindowChanged);
          window.removeEventListener("resize", onWindowChanged);
          if (visualViewport) {
            visualViewport.removeEventListener("resize", onWindowChanged);
            visualViewport.removeEventListener("scroll", onWindowChanged);
          }
          glyphFieldModifierRegions.delete(rasterId);
          markGlyphFieldModifierRegionsChanged();
          scheduleActiveGlyphRasters();
        };
        removeBlendObserver = () => {
          if (blendAnimationFrame !== 0) {
            cancelAnimationFrame(blendAnimationFrame);
          }
          element.removeEventListener("transitionrun", onRegionBlendTransitionChanged);
          element.removeEventListener("transitionend", onRegionBlendTransitionChanged);
          element.removeEventListener("transitioncancel", onRegionBlendTransitionChanged);
        };

        if (preset.layout === "fill") {
          const observer = new IntersectionObserver(
            ([entry]): void => {
              isRasterVisible = Boolean(entry && entry.isIntersecting);
              if (isRasterVisible) {
                scheduleActiveGlyphRasters();
              }
            },
            { threshold: 0.01 },
          );
          observer.observe(element);
          removeVisibilityObserver = () => observer.disconnect();
        }

        const onVisibilityChange = (): void => {
          isDocumentVisible = document.visibilityState === "visible";
          if (isDocumentVisible) {
            scheduleActiveGlyphRasters();
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        removeVisibilityListener = () =>
          document.removeEventListener("visibilitychange", onVisibilityChange);

        return;
      }

      const canvas = document.querySelector(`#${rasterId}`) as HTMLCanvasElement | null;
      if (!canvas) {
        return;
      }

      const adapter = createNoiseAdapter();
      const { gpuNoiseSeed } = adapter;
      const renderer = createWebGlGlyphRenderer({
        canvas,
        cellHeight: runtimePreset.cellHeight,
        cellWidth: runtimePreset.cellWidth,
        characters: resolvedCharacters,
        fieldModifierRegions: glyphFieldModifierRegions,
        fontSize: runtimePreset.fontSize,
        gpuNoiseSeed,
      });
      if (!renderer) {
        return;
      }

      const usesGpuGlyphSelection = renderer.usesGpuGlyphSelection === true;
      let cols = 0;
      let rows = 0;
      let changedGlyphCount = 0;
      let changedGlyphIndices = new Uint32Array();
      let brightnessValues = new Float32Array();
      let { cellHeight } = runtimePreset;
      let { cellWidth } = runtimePreset;
      let glyphEntropyPositions = new Float32Array();
      let glyphEntropyRates = new Float32Array();
      let glyphEntropyScales = new Float32Array();
      let glyphIndices = new Uint16Array();
      let framePosition = 0;
      let lastFrameAt = 0;
      let lastBrightnessSampleAt = 0;
      let lastEntropySampleSourceTime = 0;
      let sourceTime = 0;
      let lastCssHeight = 0;
      let lastCssWidth = 0;
      let lastPixelRatio = 0;
      let canvasAnchorMode: "document" | "viewport" | "" = "";
      let canvasTop = 0;
      let documentHeight = 0;
      let largeViewportHeight = window.innerHeight;
      let lastDrawnCanvasTop = -1;
      let lastDrawnSourceTime = -1;
      let lastDrawnModifierVersion = -1;

      const randomGlyphIndex = (): number => Math.floor(Math.random() * resolvedCharacters.length);
      const randomGlyphIndexExcept = (currentIndex: number): number => {
        if (resolvedCharacters.length < 2) {
          return currentIndex;
        }

        const nextIndex = Math.floor(Math.random() * (resolvedCharacters.length - 1));

        return nextIndex >= currentIndex ? nextIndex + 1 : nextIndex;
      };

      const canRender = (): boolean => isDocumentVisible && isRasterVisible;

      const resize = (): void => {
        const pixelRatio = window.devicePixelRatio || 1;
        const cssWidth = canvas.clientWidth;
        const cssHeight = canvas.clientHeight;

        if (
          cssHeight === lastCssHeight &&
          cssWidth === lastCssWidth &&
          pixelRatio === lastPixelRatio
        ) {
          scheduleActiveGlyphRasters();
          return;
        }

        lastCssHeight = cssHeight;
        lastCssWidth = cssWidth;
        lastPixelRatio = pixelRatio;

        renderer.resize({ cssHeight, cssWidth, pixelRatio });

        const grid = resolveGlyphGrid({
          cellHeight: runtimePreset.cellHeight,
          cellWidth: runtimePreset.cellWidth,
          cssHeight,
          cssWidth,
          maxCells:
            MAX_GLYPH_GRID_CELLS * (canvasAnchorMode === "document" ? DOCUMENT_ANCHOR_OVERSCAN : 1),
        });

        ({ cellHeight } = grid);
        ({ cellWidth } = grid);
        ({ cols } = grid);
        ({ rows } = grid);
        changedGlyphCount = 0;
        changedGlyphIndices = new Uint32Array(cols * rows);
        brightnessValues = new Float32Array(cols * rows);
        glyphEntropyPositions = new Float32Array(cols * rows);
        glyphEntropyRates = new Float32Array(cols * rows);
        glyphEntropyScales = new Float32Array(cols * rows);
        glyphIndices = new Uint16Array(cols * rows);
        for (let index = 0; index < glyphIndices.length; index += 1) {
          glyphIndices[index] = randomGlyphIndex();
          glyphEntropyScales[index] = 0.82 + Math.random() * 0.36;
        }
        lastBrightnessSampleAt = 0;
        lastEntropySampleSourceTime = 0;
        lastDrawnCanvasTop = -1;
        lastDrawnSourceTime = -1;

        if (canvasAnchorMode === "document") {
          const maxTop = Math.max(0, Math.floor((documentHeight - cssHeight) / cellHeight));
          canvasTop = clamp(Math.floor(canvasTop / cellHeight), 0, maxTop) * cellHeight;
          canvas.style.top = `${canvasTop}px`;
        }

        if (adapter.resize) {
          adapter.resize(cols, rows);
        }
        scheduleActiveGlyphRasters();
      };

      // The document-anchored canvas keeps a document position so the
      // Compositor scrolls it in lockstep with the page; its height covers
      // The viewport plus overscan, clamped to the document so it never
      // Extends the scrollable area.
      const updateCanvasHeight = (): void => {
        if (canvasAnchorMode !== "document") {
          return;
        }

        // Measure content height from the body's in-flow box: the canvas is
        // Absolutely positioned against the initial containing block, so
        // DocumentElement.scrollHeight would include the canvas's own stale
        // Overhang after a client-side navigation to a shorter page and the
        // Height would never shrink back.
        documentHeight = Math.max(document.body.offsetHeight, largeViewportHeight);

        const overscanHeight = Math.round(largeViewportHeight * DOCUMENT_ANCHOR_OVERSCAN);
        const nextHeight = `${Math.min(overscanHeight, Math.floor(documentHeight))}px`;

        if (canvas.style.height !== nextHeight) {
          canvas.style.height = nextHeight;
        }
      };

      const applyAnchorMode = (mode: "document" | "viewport"): void => {
        if (canvasAnchorMode === mode) {
          return;
        }

        canvasAnchorMode = mode;

        if (mode === "document") {
          canvas.style.position = "absolute";
          canvas.style.top = `${canvasTop}px`;
        } else {
          canvas.style.position = "";
          canvas.style.top = "";
          canvas.style.height = "";
        }

        updateCanvasHeight();
        resize();
      };

      const render = (time: number): void => {
        if (!canRender()) {
          return;
        }

        const frameRate = clamp(
          adapter.defaultFps ?? DEFAULT_FRAME_RATE,
          MIN_FRAME_RATE,
          MAX_FRAME_RATE,
        );
        // The GPU noise raster draws every animation frame so the
        // Document-anchored field never trails the compositor-scrolled page
        // On high-refresh displays; noise time is quantized separately.
        const rendersAtDisplayRate =
          resolvedSource.type === "procedural-noise" && typeof gpuNoiseSeed !== "undefined";

        if (!rendersAtDisplayRate && time - lastFrameAt < 1000 / frameRate) {
          return;
        }

        const elapsedMilliseconds = lastFrameAt === 0 ? 1000 / frameRate : time - lastFrameAt;
        const elapsedFrames = (elapsedMilliseconds / 1000) * frameRate;
        const currentFrame = adapter.frameCount
          ? Math.floor(framePosition) % adapter.frameCount
          : 0;
        const offsetX = 0;
        const offsetY = 0;
        const entropyMode: GlyphEntropyMode =
          renderer.supportsShaderEntropy === true && resolvedSource.type === "procedural-noise"
            ? "shader"
            : "cpu";
        const shouldThrottleBrightnessSamples =
          entropyMode === "shader" &&
          resolvedSource.type === "procedural-noise" &&
          typeof gpuNoiseSeed !== "undefined";
        const shouldSampleBrightness =
          !shouldThrottleBrightnessSamples ||
          lastBrightnessSampleAt === 0 ||
          time - lastBrightnessSampleAt >= 1000 / PROCEDURAL_ENTROPY_SAMPLE_RATE;
        const shouldUpdateBrightness = shouldSampleBrightness;
        const isInitialBrightnessSample = lastBrightnessSampleAt === 0;
        const usesDocumentAnchor =
          anchor !== "viewport" &&
          (anchor === "document" ||
            (entropyMode === "shader" && typeof gpuNoiseSeed !== "undefined"));

        applyAnchorMode(usesDocumentAnchor ? "document" : "viewport");

        if (usesDocumentAnchor && shouldUpdateBrightness) {
          // Follow late document growth (images, fonts) at the sample cadence.
          updateCanvasHeight();
          resize();
        }

        const viewportScrollY = window.scrollY;
        const viewportHeight = window.innerHeight;

        // The compositor scrolls the document-anchored canvas in lockstep
        // With the page; the main thread only re-centers it (in whole grid
        // Rows, shifting the entropy state to match) when scroll gets close
        // To an edge of its overscan.
        let shouldUploadEntropy = false;

        if (usesDocumentAnchor) {
          const edgeMargin = viewportHeight * DOCUMENT_ANCHOR_EDGE_MARGIN;
          const canvasBottom = canvasTop + lastCssHeight;
          const isNearTop = canvasTop > 0 && viewportScrollY < canvasTop + edgeMargin;
          const isNearBottom =
            canvasBottom < documentHeight - cellHeight &&
            viewportScrollY + viewportHeight > canvasBottom - edgeMargin;

          if (isNearTop || isNearBottom) {
            documentHeight = Math.max(document.body.offsetHeight, largeViewportHeight);

            const maxTopRow = Math.max(
              0,
              Math.floor((documentHeight - lastCssHeight) / cellHeight),
            );
            const centeredTopRow = Math.floor(
              (viewportScrollY - (lastCssHeight - viewportHeight) / 2) / cellHeight,
            );
            const nextTop = clamp(centeredTopRow, 0, maxTopRow) * cellHeight;
            const deltaRows = Math.round((nextTop - canvasTop) / cellHeight);

            if (deltaRows !== 0) {
              canvasTop = nextTop;
              canvas.style.top = `${canvasTop}px`;

              if (Math.abs(deltaRows) < rows) {
                shiftGridRows(glyphEntropyPositions, cols, deltaRows);
                shiftGridRows(glyphEntropyRates, cols, deltaRows);
                shiftGridRows(glyphEntropyScales, cols, deltaRows);
                shiftGridRows(brightnessValues, cols, deltaRows);
              }

              shouldUploadEntropy = true;
            }
          }
        }

        const gridOriginX = usesDocumentAnchor ? 0 : window.scrollX;
        const gridOriginY = usesDocumentAnchor ? canvasTop : viewportScrollY;

        changedGlyphCount = 0;
        lastFrameAt = time;
        sourceTime += elapsedMilliseconds;
        const entropySampleFrames =
          lastEntropySampleSourceTime === 0
            ? elapsedFrames
            : ((sourceTime - lastEntropySampleSourceTime) / 1000) * frameRate;
        const entropyRateElapsedMilliseconds =
          entropyMode === "shader" && lastEntropySampleSourceTime !== 0
            ? sourceTime - lastEntropySampleSourceTime
            : elapsedMilliseconds;
        if (shouldUpdateBrightness) {
          lastBrightnessSampleAt = time;
        }

        // In shader mode the sampled brightness only drives glyph churn rates
        // (the shader computes visible brightness itself), so it can be
        // Sampled once per block of cells and only for rows near the
        // Viewport; the display paths still sample every cell.
        const rateSampleStep = usesDocumentAnchor ? 3 : 1;
        let sampleStartRow = 0;
        let sampleEndRow = rows - 1;

        if (usesDocumentAnchor) {
          const firstVisibleRow = Math.max(
            0,
            Math.floor((viewportScrollY - canvasTop) / cellHeight) - 4,
          );

          sampleStartRow = firstVisibleRow - (firstVisibleRow % rateSampleStep);
          sampleEndRow = Math.min(
            rows - 1,
            Math.ceil((viewportScrollY + viewportHeight - canvasTop) / cellHeight) + 4,
          );
        }

        if (entropyMode === "cpu" || shouldUpdateBrightness || !usesGpuGlyphSelection) {
          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const index = row * cols + col;
              const shouldSampleCell =
                shouldUpdateBrightness && row >= sampleStartRow && row <= sampleEndRow;

              if (shouldSampleCell) {
                let brightness = 0;

                if (row % rateSampleStep !== 0 || col % rateSampleStep !== 0) {
                  brightness =
                    brightnessValues[
                      (row - (row % rateSampleStep)) * cols + (col - (col % rateSampleStep))
                    ];
                } else {
                  const worldX = gridOriginX + offsetX + (col + 0.5) * cellWidth;
                  const worldY = gridOriginY + offsetY + (row + 0.5) * cellHeight;
                  const sampledBrightness = adapter.getBrightness(
                    Math.floor(worldX / cellWidth),
                    Math.floor(worldY / cellHeight),
                    cols,
                    rows,
                    sourceTime,
                    currentFrame,
                  );

                  const baseBrightness =
                    resolvedSource.type === "procedural-noise"
                      ? noiseVisualBrightness(sampledBrightness, visualRange)
                      : sampledBrightness;
                  brightness = clamp(
                    applyGlyphFieldModifierBrightness({
                      brightness: baseBrightness,
                      regions: glyphFieldModifierRegions.values(),
                      worldX,
                      worldY,
                    }),
                    0,
                    1,
                  );
                }

                brightnessValues[index] = brightness;

                const targetEntropyRate = entropyRateForBrightness(brightness);

                glyphEntropyRates[index] = isInitialBrightnessSample
                  ? targetEntropyRate
                  : easeEntropyRate(
                      glyphEntropyRates[index],
                      targetEntropyRate,
                      entropyRateElapsedMilliseconds,
                    );
              }

              if (entropyMode === "cpu") {
                glyphEntropyPositions[index] +=
                  elapsedFrames * glyphEntropyRates[index] * glyphEntropyScales[index];
              } else if (shouldUpdateBrightness) {
                glyphEntropyPositions[index] +=
                  entropySampleFrames * glyphEntropyRates[index] * glyphEntropyScales[index];
              }

              if (!usesGpuGlyphSelection && shouldRefreshCharacter(glyphEntropyRates[index])) {
                glyphIndices[index] = randomGlyphIndexExcept(glyphIndices[index]);
                changedGlyphIndices[changedGlyphCount] = index;
                changedGlyphCount += 1;
              }
            }
          }
        }

        if (entropyMode === "shader" && shouldUpdateBrightness) {
          lastEntropySampleSourceTime = sourceTime;
        }

        const renderSourceTime =
          resolvedSource.type === "procedural-noise" && typeof gpuNoiseSeed !== "undefined"
            ? quantizeTime(sourceTime, PROCEDURAL_VISUAL_SAMPLE_RATE)
            : sourceTime;

        // A document-anchored canvas shows the same pixels regardless of
        // Scroll, so only redraw when something it renders has changed.
        const shouldDraw =
          !usesDocumentAnchor ||
          shouldUpdateBrightness ||
          shouldUploadEntropy ||
          renderSourceTime !== lastDrawnSourceTime ||
          canvasTop !== lastDrawnCanvasTop ||
          glyphFieldModifierRegionsVersion !== lastDrawnModifierVersion;

        if (shouldDraw) {
          lastDrawnSourceTime = renderSourceTime;
          lastDrawnCanvasTop = canvasTop;
          lastDrawnModifierVersion = glyphFieldModifierRegionsVersion;

          renderer.draw({
            backgroundColor: preset.backgroundColor,
            brightnessValues,
            cellHeight,
            cellWidth,
            changedGlyphCount,
            changedGlyphIndices,
            colors: preset.colors,
            cols,
            entropyMode,
            entropySampleTime: lastEntropySampleSourceTime,
            fieldModifierRegionsVersion: glyphFieldModifierRegionsVersion,
            glyphCharacters: resolvedCharacters,
            glyphEntropyPositions,
            glyphEntropyRates,
            glyphEntropyScales,
            glyphFrameRate: frameRate,
            glyphIndices,
            gpuNoiseSeed,
            gridOriginX,
            gridOriginY,
            offsetX,
            offsetY,
            rows,
            shouldUpdateBrightness,
            shouldUploadEntropy,
            sourceTime: renderSourceTime,
            visualRange,
          });
        }

        if (adapter.frameCount) {
          framePosition = (framePosition + elapsedFrames) % adapter.frameCount;
        }
      };

      activeRaster = { canRender, render };
      addActiveGlyphRaster(activeRaster);
      largeViewportHeight = readLargeViewportHeight();
      applyAnchorMode(
        typeof gpuNoiseSeed !== "undefined" && renderer.supportsShaderEntropy === true
          ? "document"
          : "viewport",
      );

      const onWindowResize = (): void => {
        largeViewportHeight = readLargeViewportHeight();
        updateCanvasHeight();
        resize();
      };

      window.addEventListener("resize", onWindowResize);
      removeResize = () => window.removeEventListener("resize", onWindowResize);

      const onVisibilityChange = (): void => {
        isDocumentVisible = document.visibilityState === "visible";
        if (isDocumentVisible) {
          lastFrameAt = 0;
          scheduleActiveGlyphRasters();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      removeVisibilityListener = () =>
        document.removeEventListener("visibilitychange", onVisibilityChange);

      if (preset.layout === "fill") {
        const observer = new IntersectionObserver(
          ([entry]): void => {
            isRasterVisible = Boolean(entry && entry.isIntersecting);
            if (isRasterVisible) {
              lastFrameAt = 0;
              scheduleActiveGlyphRasters();
            }
          },
          { threshold: 0.01 },
        );
        observer.observe(canvas);
        removeVisibilityObserver = () => observer.disconnect();
      }
    });

    if (resolvedSource.type === "frames") {
      const regionStyle =
        preset.layout === "fixed"
          ? (frameFit === "cover"
            ? "position: fixed; left: 50%; top: 50%; width: max(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))); height: calc(max(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))) / var(--glyph-raster-frame-aspect, 1)); transform: translate(-50%, -50%); transform-origin: center center; display: block; pointer-events: none;"
            : "position: fixed; left: 50%; top: 50%; width: min(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))); height: min(100vh, calc(100vw / var(--glyph-raster-frame-aspect, 1))); transform: translate(-50%, -50%); transform-origin: center center; display: block; pointer-events: none;")
          : "position: absolute; inset: 0; display: block; pointer-events: none;";

      return (
        <span
          id={rasterId}
          class={`${classes}glyph-raster-region glyph-raster-region--${preset.layout} glyph-raster-region--${resolvedSource.type}`}
          style={regionStyle}
          aria-hidden="true"
        />
      );
    }

    return (
      <canvas
        id={rasterId}
        class={`${classes}glyph-raster glyph-raster--${preset.layout} glyph-raster--${resolvedSource.type}`}
        style={style}
        aria-hidden="true"
      />
    );
  },
);
