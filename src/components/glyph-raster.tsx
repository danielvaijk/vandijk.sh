import {
  type QwikJSX,
  type TaskCtx,
  component$,
  useId,
  useStylesScoped$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";

import styles from "src/components/glyph-raster.css?inline";
import glyphFramePosters from "virtual:glyph-frame-posters";

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
  PROCEDURAL_VISUAL_SAMPLE_RATE,
  quantizeTime,
  resolveGlyphGrid,
  resolvePreset,
} from "src/vfx/glyph-raster/logic";
import { clamp } from "src/vfx/shared/math";
import { PROCEDURAL_LAYOUT_SAMPLE_RATE } from "src/vfx/glyph-raster/config";
import {
  FIELD_MODIFIER_SAMPLE_SIZE,
  type GlyphFieldModifierRegion as FieldGlyphFieldModifierRegion,
} from "src/vfx/glyph-raster/field";
import { createWebGlGlyphRenderer } from "src/vfx/glyph-raster/webgl";
import {
  createInitialGlyphFrameScript,
  createInitialGlyphModifierScript,
} from "src/vfx/glyph-raster/first-frame";
import {
  type FrameModifierBrightnessGrids,
  type GlyphRasterSource,
  createFrameModifierBrightnessGrids,
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
type GlyphInitialFrameCanvas = HTMLCanvasElement & {
  __disposeGlyphInitialFrame?: () => void;
};
type GlyphInitialModifier = {
  blend: number;
  brightnessGrid: Uint8Array;
  documentLeft: number;
  documentTop: number;
  elementId: string;
  height: number;
  width: number;
};
type GlyphInitialFrameState = {
  modifiers: GlyphInitialModifier[];
};
type GlyphInitialFrameGlobal = typeof globalThis & {
  __glyphInitialFrame?: GlyphInitialFrameState;
};

export interface GlyphRasterProps {
  blend?: number;
  class?: string;
  frameFit?: GlyphRasterFrameFit;
  anchor?: GlyphRasterAnchor;
  initialFrameSources?: string[];
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

const getInitialGlyphModifier = (rasterId: string): GlyphInitialModifier | undefined =>
  (globalThis as GlyphInitialFrameGlobal).__glyphInitialFrame?.modifiers.find(
    (modifier) => modifier.elementId === rasterId,
  );

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
): boolean => {
  const rect = region.element.getBoundingClientRect();
  const documentLeft = rect.left + window.scrollX;
  const documentTop = rect.top + window.scrollY;
  const changed =
    Math.abs(region.documentLeft - documentLeft) > 0.01 ||
    Math.abs(region.documentTop - documentTop) > 0.01 ||
    Math.abs(region.width - rect.width) > 0.01 ||
    Math.abs(region.height - rect.height) > 0.01;

  region.documentLeft = documentLeft;
  region.documentTop = documentTop;
  region.width = rect.width;
  region.height = rect.height;
  if (changed && shouldMarkChanged) {
    markGlyphFieldModifierRegionsChanged();
  }

  return changed;
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
    initialFrameSources,
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
    const noiseSeed = Math.floor(Math.random() * 0xff_ff_ff_ff);
    const entropySeed = Math.random() * 100_000;
    const style = `--glyph-raster-color: ${preset.backgroundColor};`;
    const classes = className ? `${className} ` : "";
    const initialFramePoster =
      isServer && resolvedSource.type === "frames"
        ? glyphFramePosters[resolvedSource.url]
        : undefined;
    const initialModifierPosters =
      isServer && resolvedSource.type === "procedural-noise"
        ? Object.fromEntries(
            (initialFrameSources ?? []).flatMap((sourceUrl) => {
              const poster = glyphFramePosters[sourceUrl];

              return poster
                ? [[sourceUrl, { cols: poster.cols, data: poster.data, rows: poster.rows }]]
                : [];
            }),
          )
        : {};
    const initialFrameScript =
      isServer && resolvedSource.type === "procedural-noise"
        ? createInitialGlyphFrameScript({
            backgroundColor: preset.backgroundColor,
            canvasId: rasterId,
            cellHeight: preset.cellHeight,
            cellWidth: preset.cellWidth,
            characters: resolvedCharacters,
            colors: preset.colors,
            entropySeed,
            fontSize: preset.fontSize,
            frameRate: DEFAULT_FRAME_RATE,
            gpuNoiseSeed: noiseSeed,
            maxGridCells: MAX_GLYPH_GRID_CELLS,
            modifierPosters: initialModifierPosters,
            visualRange,
          })
        : initialFramePoster && resolvedSource.type === "frames"
          ? createInitialGlyphModifierScript({
              blend: modifierBlend,
              elementId: rasterId,
              sourceUrl: resolvedSource.url,
            })
          : "";

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
      let removeInitialModifierListener = (): void => {
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
        removeInitialModifierListener();
        removeVisibilityListener();
        removeVisibilityObserver();
      });

      if (resolvedSource.type === "frames") {
        const element = document.querySelector(`#${rasterId}`) as HTMLElement | null;
        if (!element) {
          return;
        }

        const initialModifier = getInitialGlyphModifier(rasterId);
        let frameAspectRatio = Number(
          element.style.getPropertyValue("--glyph-raster-frame-aspect"),
        );
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
          brightnessGrid: initialModifier?.brightnessGrid,
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
        let availableFrameCount = 0;
        let isFrameLoadComplete = false;
        const showFirstFrame = ({ aspectRatio, grids }: FrameModifierBrightnessGrids): void => {
          if (isCleanedUp) {
            return;
          }

          frameAspectRatio = aspectRatio;
          element.style.setProperty("--glyph-raster-frame-aspect", String(aspectRatio));
          onRegionChanged();
          region.brightnessGrid = grids.subarray(0, FIELD_MODIFIER_SAMPLE_SIZE ** 2);
          markGlyphFieldModifierRegionsChanged();
          scheduleActiveGlyphRasters();
        };
        const startProgressivePlayback = ({
          defaultFps,
          frameCount,
          grids,
        }: Pick<FrameModifierBrightnessGrids, "defaultFps" | "frameCount" | "grids">): void => {
          if (activeRaster || frameCount <= 1) {
            return;
          }

          const frameSize = FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;
          const frameRate = clamp(defaultFps, MIN_FRAME_RATE, MAX_FRAME_RATE);
          let currentFrame = 0;
          let lastFrameAt = 0;

          activeRaster = {
            canRender: () => isDocumentVisible && isRasterVisible,
            render: (time: number): void => {
              if (lastFrameAt !== 0 && time - lastFrameAt < 1000 / frameRate) {
                return;
              }

              const hasNextFrame = currentFrame < availableFrameCount - 1;
              if (!hasNextFrame && !isFrameLoadComplete) {
                return;
              }

              currentFrame = hasNextFrame ? currentFrame + 1 : 0;
              const frameOffset = currentFrame * frameSize;
              region.brightnessGrid = grids.subarray(frameOffset, frameOffset + frameSize);
              markGlyphFieldModifierRegionsChanged();
              lastFrameAt = time;
            },
          };
          addActiveGlyphRaster(activeRaster);
          scheduleActiveGlyphRasters();
        };
        createFrameModifierBrightnessGrids({
          onFrame: (frame, frameGrids): void => {
            availableFrameCount = Math.max(availableFrameCount, frame + 1);
            if (frame === 0) {
              showFirstFrame(frameGrids);
            }
            startProgressivePlayback(frameGrids);
            scheduleActiveGlyphRasters();
          },
          source: resolvedSource,
        })
          .then(({ defaultFps, frameCount, grids }) => {
            if (isCleanedUp) {
              return;
            }

            availableFrameCount = frameCount;
            isFrameLoadComplete = true;
            startProgressivePlayback({ defaultFps, frameCount, grids });
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

      const renderer = createWebGlGlyphRenderer({
        canvas,
        cellHeight: runtimePreset.cellHeight,
        cellWidth: runtimePreset.cellWidth,
        characters: resolvedCharacters,
        fieldModifierRegions: glyphFieldModifierRegions,
        fontSize: runtimePreset.fontSize,
        entropySeed,
        gpuNoiseSeed: noiseSeed,
      });
      if (!renderer) {
        return;
      }

      const adoptInitialModifier = (modifier: GlyphInitialModifier): void => {
        const existingRegion = glyphFieldModifierRegions.get(modifier.elementId);
        if (existingRegion) {
          if (!existingRegion.brightnessGrid) {
            existingRegion.brightnessGrid = modifier.brightnessGrid;
            markGlyphFieldModifierRegionsChanged();
          }
          return;
        }

        const element = document.getElementById(modifier.elementId);
        if (!element) {
          return;
        }

        glyphFieldModifierRegions.set(modifier.elementId, {
          baseBlend: modifier.blend,
          blend: modifier.blend,
          brightnessGrid: modifier.brightnessGrid,
          documentLeft: modifier.documentLeft,
          documentTop: modifier.documentTop,
          element,
          height: modifier.height,
          width: modifier.width,
        });
        markGlyphFieldModifierRegionsChanged();
      };
      for (const modifier of (globalThis as GlyphInitialFrameGlobal).__glyphInitialFrame
        ?.modifiers ?? []) {
        adoptInitialModifier(modifier);
      }
      const onInitialModifier = (event: Event): void => {
        adoptInitialModifier((event as CustomEvent<GlyphInitialModifier>).detail);
        scheduleActiveGlyphRasters();
      };
      window.addEventListener("glyphinitialmodifier", onInitialModifier);
      removeInitialModifierListener = () =>
        window.removeEventListener("glyphinitialmodifier", onInitialModifier);

      let cols = 0;
      let rows = 0;
      let { cellHeight } = runtimePreset;
      let { cellWidth } = runtimePreset;
      let lastFrameAt = 0;
      let lastLayoutSampleAt = 0;
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
        lastDrawnCanvasTop = -1;
        lastDrawnSourceTime = -1;

        if (canvasAnchorMode === "document") {
          const maxTop = Math.max(0, Math.floor((documentHeight - cssHeight) / cellHeight));
          canvasTop = clamp(Math.floor(canvasTop / cellHeight), 0, maxTop) * cellHeight;
          canvas.style.top = `${canvasTop}px`;
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

        const frameRate = clamp(DEFAULT_FRAME_RATE, MIN_FRAME_RATE, MAX_FRAME_RATE);
        // The GPU noise raster draws every animation frame so the
        // Document-anchored field never trails the compositor-scrolled page
        // On high-refresh displays; noise time is quantized separately.
        const elapsedMilliseconds = lastFrameAt === 0 ? 0 : time - lastFrameAt;
        const offsetX = 0;
        const offsetY = 0;
        const usesDocumentAnchor = anchor !== "viewport";
        const shouldUpdateLayout =
          lastLayoutSampleAt === 0 ||
          time - lastLayoutSampleAt >= 1000 / PROCEDURAL_LAYOUT_SAMPLE_RATE;

        applyAnchorMode(usesDocumentAnchor ? "document" : "viewport");

        if (usesDocumentAnchor && shouldUpdateLayout) {
          // Follow late document growth (images, fonts) at the sample cadence.
          lastLayoutSampleAt = time;
          let didUpdateModifierBounds = false;
          for (const region of glyphFieldModifierRegions.values()) {
            didUpdateModifierBounds =
              updateGlyphFieldModifierRegionBounds(region, false) || didUpdateModifierBounds;
          }
          if (didUpdateModifierBounds) {
            markGlyphFieldModifierRegionsChanged();
          }
          updateCanvasHeight();
          resize();
        }

        const viewportScrollY = window.scrollY;
        const viewportHeight = window.innerHeight;

        // The compositor scrolls the document-anchored canvas in lockstep
        // With the page; the main thread only re-centers it (in whole grid
        // Rows) when scroll gets close to an edge of its overscan.

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
            if (nextTop !== canvasTop) {
              canvasTop = nextTop;
              canvas.style.top = `${canvasTop}px`;
            }
          }
        }

        const gridOriginX = usesDocumentAnchor ? 0 : window.scrollX;
        const gridOriginY = usesDocumentAnchor ? canvasTop : viewportScrollY;

        lastFrameAt = time;
        sourceTime += elapsedMilliseconds;
        const renderSourceTime = quantizeTime(sourceTime, PROCEDURAL_VISUAL_SAMPLE_RATE);

        // A document-anchored canvas shows the same pixels regardless of
        // Scroll, so only redraw when something it renders has changed.
        const shouldDraw =
          !usesDocumentAnchor ||
          renderSourceTime !== lastDrawnSourceTime ||
          canvasTop !== lastDrawnCanvasTop ||
          glyphFieldModifierRegionsVersion !== lastDrawnModifierVersion;

        if (shouldDraw) {
          lastDrawnSourceTime = renderSourceTime;
          lastDrawnCanvasTop = canvasTop;
          lastDrawnModifierVersion = glyphFieldModifierRegionsVersion;

          renderer.draw({
            backgroundColor: preset.backgroundColor,
            cellHeight,
            cellWidth,
            colors: preset.colors,
            cols,
            fieldModifierRegionsVersion: glyphFieldModifierRegionsVersion,
            glyphFrameRate: frameRate,
            gridOriginX,
            gridOriginY,
            offsetX,
            offsetY,
            rows,
            sourceTime: renderSourceTime,
            visualRange,
          });
        }
      };

      activeRaster = { canRender, render };
      addActiveGlyphRaster(activeRaster);
      largeViewportHeight = readLargeViewportHeight();
      applyAnchorMode(anchor === "viewport" ? "viewport" : "document");
      render(performance.now());
      (canvas as GlyphInitialFrameCanvas).__disposeGlyphInitialFrame?.();

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
      const initialAspectStyle = initialFramePoster
        ? `--glyph-raster-frame-aspect: ${initialFramePoster.aspectRatio};`
        : "";
      const regionStyle =
        initialAspectStyle +
        (preset.layout === "fixed"
          ? frameFit === "cover"
            ? "position: fixed; left: 50%; top: 50%; width: max(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))); height: calc(max(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))) / var(--glyph-raster-frame-aspect, 1)); transform: translate(-50%, -50%); transform-origin: center center; display: block; pointer-events: none;"
            : "position: fixed; left: 50%; top: 50%; width: min(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))); height: min(100vh, calc(100vw / var(--glyph-raster-frame-aspect, 1))); transform: translate(-50%, -50%); transform-origin: center center; display: block; pointer-events: none;"
          : "position: absolute; inset: 0; display: block; pointer-events: none;");

      return (
        <>
          <span
            id={rasterId}
            class={`${classes}glyph-raster-region glyph-raster-region--${preset.layout} glyph-raster-region--${resolvedSource.type}`}
            style={regionStyle}
            aria-hidden="true"
          />

          {initialFrameScript && <script dangerouslySetInnerHTML={initialFrameScript} />}
        </>
      );
    }

    return (
      <>
        <canvas
          id={rasterId}
          class={`${classes}glyph-raster glyph-raster--${preset.layout} glyph-raster--${resolvedSource.type}`}
          style={style}
          aria-hidden="true"
        />

        {initialFrameScript && <script dangerouslySetInnerHTML={initialFrameScript} />}
      </>
    );
  },
);
