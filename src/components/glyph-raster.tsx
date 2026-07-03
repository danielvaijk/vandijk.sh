import type { QwikJSX } from "@builder.io/qwik";
import { component$, useId, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";

import styles from "src/components/glyph-raster.scss?inline";

type GlyphRasterLayout = "fill" | "fixed";
type GlyphRasterFrameFit = "contain" | "cover";
type GlyphRasterAnchor = "auto" | "document" | "viewport";

export type GlyphRasterFrameSource = {
  type: "frames";
  url: string;
};

export type GlyphRasterNoiseSource = {
  type: "procedural-noise";
};

export type GlyphRasterSource = GlyphRasterFrameSource | GlyphRasterNoiseSource;

export type GlyphRasterProps = {
  blend?: number;
  class?: string;
  frameFit?: GlyphRasterFrameFit;
  anchor?: GlyphRasterAnchor;
  layout?: GlyphRasterLayout;
  opacity?: number;
  source?: GlyphRasterSource;
};

type SourceAdapter = {
  defaultFps?: number;
  frameCount?: number;
  getBrightness: (
    col: number,
    row: number,
    cols: number,
    rows: number,
    time: number,
    frame: number,
  ) => number;
  gpuNoiseSeed?: number;
  resize?: (cols: number, rows: number) => void;
};

type ParsedFrameSource = {
  aspectRatio: number;
  defaultFps: number;
  frameCount: number;
  frameSize: number;
  frames: Uint8Array;
  cols: number;
  rows: number;
};

type FrameModifierBrightnessGrids = {
  aspectRatio: number;
  defaultFps: number;
  frameCount: number;
  grids: Uint8Array;
};

type GlyphEntropyMode = "cpu" | "shader";

type GlyphRenderer = {
  draw: (state: GlyphRenderState) => void;
  resize: (size: GlyphRenderSize) => void;
  supportsShaderEntropy?: boolean;
  usesGpuGlyphSelection?: boolean;
};

type GlyphRenderSize = {
  cssHeight: number;
  cssWidth: number;
  pixelRatio: number;
};

type GlyphRenderState = {
  backgroundColor: string;
  brightnessValues: Float32Array;
  cellHeight: number;
  cellWidth: number;
  changedGlyphCount: number;
  changedGlyphIndices: Uint32Array;
  colors: string[];
  cols: number;
  entropySampleTime: number;
  gpuNoiseSeed?: number;
  glyphCharacters: string[];
  glyphEntropyPositions: Float32Array;
  glyphEntropyRates: Float32Array;
  glyphEntropyScales: Float32Array;
  glyphIndices: Uint16Array;
  glyphFrameRate: number;
  offsetX: number;
  offsetY: number;
  rows: number;
  entropyMode: GlyphEntropyMode;
  shouldUpdateBrightness: boolean;
  shouldUploadEntropy: boolean;
  sourceTime: number;
  gridOriginX: number;
  gridOriginY: number;
  visualRange: number;
};

type ActiveGlyphRaster = {
  canRender: () => boolean;
  render: (time: number) => void;
};

type GlyphRasterPreset = {
  backgroundColor: string;
  cellHeight: number;
  cellWidth: number;
  colors: string[];
  fontSize: number;
  layout: GlyphRasterLayout;
};

type GlyphFieldModifierRegion = {
  baseBlend: number;
  blend: number;
  brightnessGrid?: Uint8Array;
  documentLeft: number;
  documentTop: number;
  element: HTMLElement;
  height: number;
  width: number;
};

const GLYPH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
const GLYPH_COLORS = ["#2e2e2e", "#585858", "#8a8a8a", "#d0d0d0", "#f4f4f4"];
const NOISE_COLORS = ["#070707", "#151515", "#303030", "#747474", "#ffffff"];
const GLYPH_FONT_FAMILY = 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif';
const GLYPH_HORIZONTAL_SCALE = 1.09;
const NOISE_CELL_WIDTH = 8;
const NOISE_CELL_HEIGHT = 14;
const NOISE_FONT_SIZE = 13;
const NOISE_VISUAL_WHITE_POINT = 0.63;
const DEFAULT_FRAME_RATE = 18;
const MIN_FRAME_RATE = 1;
const MAX_FRAME_RATE = 60;
const PROCEDURAL_ENTROPY_SAMPLE_RATE = 9;
const PROCEDURAL_VISUAL_SAMPLE_RATE = 30;
const MAX_FIELD_MODIFIER_REGIONS = 8;
const FIELD_MODIFIER_SAMPLE_SIZE = 256;
const FIELD_MODIFIER_BRIGHTNESS_BOOST = 1;
const FIELD_MODIFIER_BRIGHTNESS_FLOOR = 0.07;
const FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT = 1;
const GLYPH_ENTROPY_RATE_EASE_SECONDS = 0.35;
// Height of the document-anchored noise canvas in large-viewport multiples,
// and how close (in viewport fractions) scroll may get to a canvas edge
// before the canvas is re-centered around the viewport.
const DOCUMENT_ANCHOR_OVERSCAN = 2.5;
const DOCUMENT_ANCHOR_EDGE_MARGIN = 0.35;
const MIN_GLYPH_CELL_SCALE = 1;
const MAX_GLYPH_CELL_SCALE = 8;
const MAX_GLYPH_GRID_CELLS = 18000;
const MAX_GLYPH_ATLAS_CACHE_SIZE = 8;
const MAX_GLYPH_DRAW_METRICS_CACHE_SIZE = 512;
const MAX_FRAME_BRIGHTNESS_CACHE_SIZE = 8;
const MAX_PARSED_COLOR_CACHE_SIZE = 32;
const GLYPH_CELL_PADDING_RATIO = 0.08;
const DIAGONAL_GRADIENT = Math.SQRT1_2;
const FRACTAL_NOISE_RANGE = 0.52 + 0.26 + 0.13 + 0.065;
const GLYPH_QUAD_CORNERS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
const glyphAtlasCache = new Map<
  string,
  {
    canvas: HTMLCanvasElement;
    glyphUvs: Float32Array;
  }
>();
const frameBrightnessCache = new Map<string, Uint8Array>();
const glyphDrawMetricsCache = new Map<
  string,
  {
    offsetX: number;
    offsetY: number;
    scale: number;
  }
>();
const parsedColorCache = new Map<string, [number, number, number, number]>();
const activeGlyphRasters = new Set<ActiveGlyphRaster>();
const glyphFieldModifierRegions = new Map<string, GlyphFieldModifierRegion>();
let activeGlyphRasterFrame = 0;
let glyphFieldModifierRegionsVersion = 0;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const readCssLength = (name: string, fallback: number): number => {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  if (!value) return fallback;

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

  const height = probe.getBoundingClientRect().height;
  probe.remove();

  return height > 0 ? height : window.innerHeight;
};

const resolveRuntimePreset = (preset: GlyphRasterPreset): GlyphRasterPreset => ({
  ...preset,
  cellHeight: readCssLength("--glyph-cell-height", preset.cellHeight),
  cellWidth: readCssLength("--glyph-cell-width", preset.cellWidth),
  fontSize: readCssLength("--glyph-font-size", preset.fontSize),
});

const resolveGlyphGrid = ({
  cellHeight,
  cellWidth,
  cssHeight,
  cssWidth,
  maxCells = MAX_GLYPH_GRID_CELLS,
}: {
  cellHeight: number;
  cellWidth: number;
  cssHeight: number;
  cssWidth: number;
  maxCells?: number;
}): {
  cellHeight: number;
  cellWidth: number;
  cols: number;
  rows: number;
} => {
  const baseCols = Math.max(1, Math.ceil(cssWidth / cellWidth));
  const baseRows = Math.max(1, Math.ceil(cssHeight / cellHeight));
  const baseCellCount = baseCols * baseRows;
  const cellScale = clamp(
    Math.sqrt(baseCellCount / maxCells),
    MIN_GLYPH_CELL_SCALE,
    MAX_GLYPH_CELL_SCALE,
  );
  const resolvedCellWidth = cellWidth * cellScale;
  const resolvedCellHeight = cellHeight * cellScale;

  // One extra row/col so the grid still covers the viewport when it is
  // shifted by the fractional scroll offset to stay anchored to the document.
  return {
    cellHeight: resolvedCellHeight,
    cellWidth: resolvedCellWidth,
    cols: Math.max(1, Math.ceil(cssWidth / resolvedCellWidth)) + 1,
    rows: Math.max(1, Math.ceil(cssHeight / resolvedCellHeight)) + 1,
  };
};

const shiftGridRows = (values: Float32Array, cols: number, deltaRows: number): void => {
  const offset = Math.abs(deltaRows) * cols;

  if (deltaRows > 0) {
    values.copyWithin(0, offset);
  } else {
    values.copyWithin(offset, 0, values.length - offset);
  }
};

function getCachedValue<Value>(cache: Map<string, Value>, key: string): Value | undefined {
  const value = cache.get(key);
  if (value === undefined) return undefined;

  cache.delete(key);
  cache.set(key, value);

  return value;
}

function setCachedValue<Value>(
  cache: Map<string, Value>,
  key: string,
  value: Value,
  maxSize: number,
): void {
  cache.delete(key);
  cache.set(key, value);

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) return;

    cache.delete(oldestKey);
  }
}

const fade = (value: number): number => value * value * value * (value * (value * 6 - 15) + 10);

const lerp = (start: number, end: number, amount: number): number => start + (end - start) * amount;

const quantizeTime = (time: number, sampleRate: number): number => {
  const interval = 1000 / sampleRate;

  return Math.floor(time / interval) * interval;
};

const hash = (x: number, y: number, seed: number): number => {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);

  return (value ^ (value >>> 16)) >>> 0;
};

const gradient = (x: number, y: number, seed: number, dx: number, dy: number): number => {
  switch (hash(x, y, seed) & 7) {
    case 0:
      return dx;
    case 1:
      return -dx;
    case 2:
      return dy;
    case 3:
      return -dy;
    case 4:
      return (dx + dy) * DIAGONAL_GRADIENT;
    case 5:
      return (dx - dy) * DIAGONAL_GRADIENT;
    case 6:
      return (-dx + dy) * DIAGONAL_GRADIENT;
    default:
      return (-dx - dy) * DIAGONAL_GRADIENT;
  }
};

const perlin = (x: number, y: number, seed: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  const sx = fade(dx);
  const sy = fade(dy);
  const top = lerp(gradient(x0, y0, seed, dx, dy), gradient(x0 + 1, y0, seed, dx - 1, dy), sx);
  const bottom = lerp(
    gradient(x0, y0 + 1, seed, dx, dy - 1),
    gradient(x0 + 1, y0 + 1, seed, dx - 1, dy - 1),
    sx,
  );

  return lerp(top, bottom, sy);
};

const fractalNoise = (x: number, y: number, seed: number): number => {
  const total =
    perlin(x, y, seed) * 0.52 +
    perlin(x * 2, y * 2, seed + 101) * 0.26 +
    perlin(x * 4, y * 4, seed + 202) * 0.13 +
    perlin(x * 8, y * 8, seed + 303) * 0.065;

  return total / FRACTAL_NOISE_RANGE;
};

const smoothstep = (edgeStart: number, edgeEnd: number, value: number): number => {
  const amount = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);

  return amount * amount * (3 - 2 * amount);
};

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
  const opacity = Number.parseFloat(getComputedStyle(region.element).opacity);
  const nextBlend = region.baseBlend * (Number.isFinite(opacity) ? clamp(opacity, 0, 1) : 1);

  if (Math.abs(region.blend - nextBlend) <= 0.001) {
    return false;
  }

  region.blend = nextBlend;
  markGlyphFieldModifierRegionsChanged();
  return true;
};

const applyGlyphFieldModifierBrightness = (
  brightness: number,
  worldX: number,
  worldY: number,
): number => {
  let modifierBrightness = 0;

  for (const region of glyphFieldModifierRegions.values()) {
    if (
      region.width > 0 &&
      region.height > 0 &&
      worldX >= region.documentLeft &&
      worldX < region.documentLeft + region.width &&
      worldY >= region.documentTop &&
      worldY < region.documentTop + region.height
    ) {
      if (!region.brightnessGrid) {
        modifierBrightness = Math.max(
          modifierBrightness,
          FIELD_MODIFIER_BRIGHTNESS_FLOOR * region.blend,
        );
        continue;
      }

      const u = clamp((worldX - region.documentLeft) / region.width, 0, 0.999999);
      const v = clamp((worldY - region.documentTop) / region.height, 0, 0.999999);
      const sampleX = u * (FIELD_MODIFIER_SAMPLE_SIZE - 1);
      const sampleY = v * (FIELD_MODIFIER_SAMPLE_SIZE - 1);
      const left = Math.floor(sampleX);
      const top = Math.floor(sampleY);
      const right = Math.min(FIELD_MODIFIER_SAMPLE_SIZE - 1, left + 1);
      const bottom = Math.min(FIELD_MODIFIER_SAMPLE_SIZE - 1, top + 1);
      const amountX = sampleX - left;
      const amountY = sampleY - top;
      const topBrightness = lerp(
        region.brightnessGrid[top * FIELD_MODIFIER_SAMPLE_SIZE + left] / 255,
        region.brightnessGrid[top * FIELD_MODIFIER_SAMPLE_SIZE + right] / 255,
        amountX,
      );
      const bottomBrightness = lerp(
        region.brightnessGrid[bottom * FIELD_MODIFIER_SAMPLE_SIZE + left] / 255,
        region.brightnessGrid[bottom * FIELD_MODIFIER_SAMPLE_SIZE + right] / 255,
        amountX,
      );
      const regionBrightness = lerp(topBrightness, bottomBrightness, amountY);
      const mappedRegionBrightness = smoothstep(
        0,
        FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT,
        regionBrightness,
      );
      const liftedRegionBrightness =
        FIELD_MODIFIER_BRIGHTNESS_FLOOR +
        mappedRegionBrightness * (1 - FIELD_MODIFIER_BRIGHTNESS_FLOOR);

      modifierBrightness = Math.max(modifierBrightness, liftedRegionBrightness * region.blend);
    }
  }

  return (
    brightness +
    Math.min(1, modifierBrightness * FIELD_MODIFIER_BRIGHTNESS_BOOST) * (1 - brightness)
  );
};

const hasActiveGlyphRaster = (): boolean => {
  for (const raster of activeGlyphRasters) {
    if (raster.canRender()) return true;
  }

  return false;
};

const renderActiveGlyphRasters = (time: number): void => {
  // Keep the fired handle non-zero while rasters render so re-entrant
  // scheduleActiveGlyphRasters() calls (e.g. resize() from within render)
  // cannot arm a second, parallel rAF chain.
  for (const raster of activeGlyphRasters) {
    raster.render(time);
  }

  activeGlyphRasterFrame = hasActiveGlyphRaster()
    ? requestAnimationFrame(renderActiveGlyphRasters)
    : 0;
};

const scheduleActiveGlyphRasters = (): void => {
  if (activeGlyphRasterFrame !== 0 || !hasActiveGlyphRaster()) return;

  activeGlyphRasterFrame = requestAnimationFrame(renderActiveGlyphRasters);
};

const solarSurfaceBrightness = (col: number, row: number, time: number, seed: number): number => {
  const seconds = time / 1000;
  const x = col * 0.075;
  const y = row * 0.075;
  const convection = fractalNoise(
    x * 0.55 + seconds * 0.035,
    y * 0.55 - seconds * 0.025,
    seed + 211,
  );
  const shear = fractalNoise(x * 0.32 - seconds * 0.02, y * 0.32 + seconds * 0.03, seed + 353);
  const burstNoise = fractalNoise(
    x * 0.72 - seconds * 0.11 + convection * 0.35,
    y * 0.72 + seconds * 0.09 + shear * 0.35,
    seed + 1201,
  );
  const burst = smoothstep(0.48, 0.88, (burstNoise + 1) * 0.5);
  const displacement = convection * 2.4 + burst * 1.15;
  const arc = Math.sin((x - y) * 1.65 + seconds * 0.62 + convection * 3.4) * (0.28 + burst * 0.95);
  const twistX = Math.sin(y * 2.1 + seconds * 0.86 + shear * 4.2) * burst * 1.05;
  const twistY = Math.cos(x * 1.9 - seconds * 0.74 + convection * 4.0) * burst * 0.92;
  const flowX =
    x + displacement + arc + twistX + Math.sin(y * 1.3 + seconds * 0.45 + shear * 2.4) * 0.45;
  const flowY =
    y +
    shear * 1.85 -
    arc * 0.72 +
    twistY +
    Math.cos(x * 1.1 - seconds * 0.38 + convection * 2.1) * 0.42;
  const plumeNoise = fractalNoise(
    flowX * 0.95 - seconds * 0.24,
    flowY * 0.95 + seconds * 0.18,
    seed + 401,
  );
  const filamentNoise = fractalNoise(
    flowX * 2.6 + plumeNoise * 1.4 - seconds * 0.5,
    flowY * 1.8 - convection * 1.2 + seconds * 0.28,
    seed + 809,
  );
  const cells = smoothstep(0.34, 0.78, (plumeNoise + 1) * 0.5);
  const filaments = smoothstep(0.5, 0.9, (filamentNoise + 1) * 0.5);
  const pulse =
    0.5 + Math.sin(seconds * 0.7 + convection * 3.2 + shear * 2.4) * 0.06 + burst * 0.12;
  const softCells = smoothstep(0.16, 0.82, (plumeNoise + 1) * 0.5);
  const coreCells = cells * cells;
  const depth = softCells * 0.28 + coreCells * 0.42 + filaments * 0.24 + burst * 0.18;

  return clamp(0.12 + (depth + (convection + 1) * 0.07) * pulse, 0, 1);
};

const noiseVisualBrightness = (brightness: number, visualRange: number): number =>
  clamp((brightness / NOISE_VISUAL_WHITE_POINT) * visualRange, 0, 1);

const resolveSource = (source: GlyphRasterSource | undefined): GlyphRasterSource => {
  if (source) return source;

  return { type: "procedural-noise" };
};

const resolvePreset = (
  source: GlyphRasterSource,
  layout: GlyphRasterLayout | undefined,
): GlyphRasterPreset => ({
  backgroundColor: "#050505",
  cellHeight: NOISE_CELL_HEIGHT,
  cellWidth: NOISE_CELL_WIDTH,
  colors: source.type === "procedural-noise" ? NOISE_COLORS : GLYPH_COLORS,
  fontSize: NOISE_FONT_SIZE,
  layout: layout ?? "fixed",
});

const createNoiseAdapter = (): SourceAdapter => {
  const seed = Math.floor(Math.random() * 0xffffffff);

  return {
    defaultFps: DEFAULT_FRAME_RATE,
    getBrightness: (col, row, _cols, _rows, time) => solarSurfaceBrightness(col, row, time, seed),
    gpuNoiseSeed: seed,
  };
};

const loadFrameSource = async (source: GlyphRasterFrameSource): Promise<ParsedFrameSource> => {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Unable to load character animation frames from ${source.url}.`);
  }

  const raw = new Uint8Array(await response.arrayBuffer());
  const headerEnd = raw.indexOf(10);

  if (headerEnd < 0) {
    throw new Error(`Unable to parse character animation frames from ${source.url}.`);
  }

  const header = JSON.parse(new TextDecoder().decode(raw.subarray(0, headerEnd))) as {
    cols: number;
    fps?: number;
    n_frames: number;
    rows: number;
  };
  const frames = raw.subarray(headerEnd + 1);
  const frameSize = header.cols * header.rows;
  const horizontalScale = GLYPH_HORIZONTAL_SCALE;

  return {
    aspectRatio:
      ((header.cols / horizontalScale) * NOISE_CELL_WIDTH) / (header.rows * NOISE_CELL_HEIGHT),
    cols: header.cols,
    defaultFps: header.fps ?? DEFAULT_FRAME_RATE,
    frameCount: header.n_frames,
    frameSize,
    frames,
    rows: header.rows,
  };
};

const sampleFrameBrightness = (
  frameSource: ParsedFrameSource,
  frame: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
): number => {
  const sourceFrameOffset = frame * frameSource.frameSize;
  const sourceRow = Math.min(
    frameSource.rows - 1,
    Math.floor(((row + 0.5) * frameSource.rows) / rows),
  );
  const sourceCol = Math.min(
    frameSource.cols - 1,
    Math.floor(((col + 0.5) * frameSource.cols) / cols),
  );

  return frameSource.frames[sourceFrameOffset + sourceRow * frameSource.cols + sourceCol];
};

const createFrameModifierBrightnessGrids = async (
  source: GlyphRasterFrameSource,
): Promise<FrameModifierBrightnessGrids> => {
  const frameSource = await loadFrameSource(source);
  const sampledFrameSize = FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;
  const cacheKey = [
    source.url,
    "modifier",
    frameSource.cols,
    frameSource.rows,
    frameSource.frameCount,
    FIELD_MODIFIER_SAMPLE_SIZE,
  ].join(":");
  const cachedGrids = getCachedValue(frameBrightnessCache, cacheKey);
  if (cachedGrids) {
    return {
      aspectRatio: frameSource.aspectRatio,
      defaultFps: frameSource.defaultFps,
      frameCount: frameSource.frameCount,
      grids: cachedGrids,
    };
  }

  const grids = new Uint8Array(frameSource.frameCount * sampledFrameSize);

  for (let frame = 0; frame < frameSource.frameCount; frame += 1) {
    const sampledFrameOffset = frame * sampledFrameSize;

    for (let row = 0; row < FIELD_MODIFIER_SAMPLE_SIZE; row += 1) {
      for (let col = 0; col < FIELD_MODIFIER_SAMPLE_SIZE; col += 1) {
        grids[sampledFrameOffset + row * FIELD_MODIFIER_SAMPLE_SIZE + col] = sampleFrameBrightness(
          frameSource,
          frame,
          col,
          row,
          FIELD_MODIFIER_SAMPLE_SIZE,
          FIELD_MODIFIER_SAMPLE_SIZE,
        );
      }
    }
  }

  setCachedValue(frameBrightnessCache, cacheKey, grids, MAX_FRAME_BRIGHTNESS_CACHE_SIZE);

  return {
    aspectRatio: frameSource.aspectRatio,
    defaultFps: frameSource.defaultFps,
    frameCount: frameSource.frameCount,
    grids,
  };
};

const brightnessEntropy = (brightness: number): number =>
  0.04 + smoothstep(0.08, 0.92, brightness) * 0.24;

const proceduralEntropyBrightness = (brightness: number): number =>
  smoothstep(0.22, 0.78, brightness);

const entropyRateForBrightness = (brightness: number): number =>
  brightnessEntropy(proceduralEntropyBrightness(brightness));

const easeEntropyRate = (
  currentRate: number,
  targetRate: number,
  elapsedMilliseconds: number,
): number => {
  const amount = 1 - Math.exp(-(elapsedMilliseconds / 1000) / GLYPH_ENTROPY_RATE_EASE_SECONDS);

  return lerp(currentRate, targetRate, amount);
};

const shouldRefreshCharacter = (entropyRate: number): boolean => Math.random() < entropyRate;

const parseColor = (color: string): [number, number, number, number] => {
  const cachedColor = getCachedValue(parsedColorCache, color);
  if (cachedColor) return cachedColor;

  let parsedColor: [number, number, number, number];

  if (/^#[\da-f]{3}$/iu.test(color)) {
    parsedColor = [
      Number.parseInt(color[1] + color[1], 16) / 255,
      Number.parseInt(color[2] + color[2], 16) / 255,
      Number.parseInt(color[3] + color[3], 16) / 255,
      1,
    ];
  } else if (/^#[\da-f]{6}$/iu.test(color)) {
    parsedColor = [
      Number.parseInt(color.slice(1, 3), 16) / 255,
      Number.parseInt(color.slice(3, 5), 16) / 255,
      Number.parseInt(color.slice(5, 7), 16) / 255,
      1,
    ];
  } else {
    parsedColor = [1, 1, 1, 1];
  }

  setCachedValue(parsedColorCache, color, parsedColor, MAX_PARSED_COLOR_CACHE_SIZE);

  return parsedColor;
};

const hasVisibleRasterPixels = (
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  backgroundColor: string,
): boolean => {
  if (width <= 0 || height <= 0) return true;

  const pixels = new Uint8Array(width * height * 4);
  const [backgroundRed, backgroundGreen, backgroundBlue] = parseColor(backgroundColor);
  const red = Math.round(backgroundRed * 255);
  const green = Math.round(backgroundGreen * 255);
  const blue = Math.round(backgroundBlue * 255);

  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  for (let index = 0; index < pixels.length; index += 4) {
    const distance =
      Math.abs(pixels[index] - red) +
      Math.abs(pixels[index + 1] - green) +
      Math.abs(pixels[index + 2] - blue);

    if (distance > 24) return true;
  }

  return false;
};

const compileShader = (
  gl: WebGL2RenderingContext,
  source: string,
  type: number,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

const createProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null => {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!vertexShader || !fragmentShader || !program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
};

const getGlyphDrawMetrics = (
  context: CanvasRenderingContext2D,
  glyph: string,
  cellWidth: number,
  cellHeight: number,
  fontSize: number,
): {
  offsetX: number;
  offsetY: number;
  scale: number;
} => {
  const cacheKey = [glyph, cellWidth, cellHeight, fontSize].join(":");
  const cachedMetrics = getCachedValue(glyphDrawMetricsCache, cacheKey);
  if (cachedMetrics) return cachedMetrics;

  const metrics = context.measureText(glyph);
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || fontSize;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const glyphWidth = Math.max(1, left + right);
  const glyphHeight = Math.max(1, ascent + descent);
  const paddingX = Math.max(0.5, cellWidth * GLYPH_CELL_PADDING_RATIO);
  const paddingY = Math.max(0.5, cellHeight * GLYPH_CELL_PADDING_RATIO);
  const scale = Math.min(
    1,
    Math.max(1, cellWidth - paddingX * 2) / glyphWidth,
    Math.max(1, cellHeight - paddingY * 2) / glyphHeight,
  );
  const offsetX = (cellWidth - glyphWidth * scale) / 2 + left * scale;
  const offsetY = (cellHeight - glyphHeight * scale) / 2 + ascent * scale;
  const resolvedMetrics = { offsetX, offsetY, scale };

  setCachedValue(
    glyphDrawMetricsCache,
    cacheKey,
    resolvedMetrics,
    MAX_GLYPH_DRAW_METRICS_CACHE_SIZE,
  );

  return resolvedMetrics;
};

const drawGlyphInCell = (
  context: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  cellWidth: number,
  cellHeight: number,
  fontSize: number,
): void => {
  const metrics = getGlyphDrawMetrics(context, glyph, cellWidth, cellHeight, fontSize);

  context.save();
  context.translate(x + metrics.offsetX, y + metrics.offsetY);
  context.scale(metrics.scale, metrics.scale);
  context.fillText(glyph, 0, 0);
  context.restore();
};

const createGlyphAtlas = ({
  cellHeight,
  cellWidth,
  characters,
  fontSize,
  pixelRatio,
}: {
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  fontSize: number;
  pixelRatio: number;
}): {
  canvas: HTMLCanvasElement;
  glyphUvs: Float32Array;
} => {
  const cacheKey = [cellHeight, cellWidth, characters.join(""), fontSize, pixelRatio].join(":");
  const cachedAtlas = getCachedValue(glyphAtlasCache, cacheKey);
  if (cachedAtlas) return cachedAtlas;

  const atlasCols = Math.ceil(Math.sqrt(characters.length));
  const atlasRows = Math.ceil(characters.length / atlasCols);
  const atlasCellWidth = Math.max(1, Math.ceil(cellWidth * pixelRatio));
  const atlasCellHeight = Math.max(1, Math.ceil(cellHeight * pixelRatio));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const glyphUvs = new Float32Array(characters.length * 4);

  canvas.width = atlasCols * atlasCellWidth;
  canvas.height = atlasRows * atlasCellHeight;

  if (!context) return { canvas, glyphUvs };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = `${fontSize * pixelRatio}px ${GLYPH_FONT_FAMILY}`;
  context.textBaseline = "alphabetic";

  for (let index = 0; index < characters.length; index += 1) {
    const glyph = characters[index];
    const col = index % atlasCols;
    const row = Math.floor(index / atlasCols);
    const x = col * atlasCellWidth;
    const y = row * atlasCellHeight;
    const uvIndex = index * 4;

    drawGlyphInCell(context, glyph, x, y, atlasCellWidth, atlasCellHeight, fontSize * pixelRatio);
    glyphUvs[uvIndex] = x / canvas.width;
    glyphUvs[uvIndex + 1] = y / canvas.height;
    glyphUvs[uvIndex + 2] = atlasCellWidth / canvas.width;
    glyphUvs[uvIndex + 3] = atlasCellHeight / canvas.height;
  }

  const atlas = { canvas, glyphUvs };
  setCachedValue(glyphAtlasCache, cacheKey, atlas, MAX_GLYPH_ATLAS_CACHE_SIZE);

  return atlas;
};

const createCanvasGlyphRenderer = (
  canvas: HTMLCanvasElement,
  fontSize: number,
): GlyphRenderer | null => {
  const context = canvas.getContext("2d");
  if (!context) return null;

  return {
    draw: ({
      backgroundColor,
      brightnessValues,
      cellHeight,
      cellWidth,
      colors,
      cols,
      glyphCharacters,
      glyphIndices,
      offsetX,
      offsetY,
      rows,
    }: GlyphRenderState): void => {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      context.font = `${fontSize}px ${GLYPH_FONT_FAMILY}`;
      context.textBaseline = "alphabetic";

      let currentColor = backgroundColor;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const index = row * cols + col;
          const color =
            colors[
              Math.min(colors.length - 1, Math.floor(brightnessValues[index] * colors.length))
            ];

          if (color !== currentColor) {
            context.fillStyle = color;
            currentColor = color;
          }

          drawGlyphInCell(
            context,
            glyphCharacters[glyphIndices[index]],
            offsetX + col * cellWidth,
            offsetY + row * cellHeight,
            cellWidth,
            cellHeight,
            fontSize,
          );
        }
      }
    },
    resize: ({ cssHeight, cssWidth, pixelRatio }: GlyphRenderSize): void => {
      canvas.width = cssWidth * pixelRatio;
      canvas.height = cssHeight * pixelRatio;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    },
  };
};

const GLYPH_NOISE_GLSL = `
float glyphHash(vec2 value, float seed) {
  vec3 seeded = fract(vec3(value, seed) * vec3(0.1031, 0.11369, 0.13787));
  seeded += dot(seeded, seeded.yzx + 19.19);
  return fract((seeded.x + seeded.y) * seeded.z);
}

float glyphGradient(vec2 cell, vec2 offset, float seed) {
  float angle = glyphHash(cell, seed) * 6.28318530718;
  return dot(vec2(cos(angle), sin(angle)), offset);
}

float glyphPerlin(vec2 point, float seed) {
  vec2 cell = floor(point);
  vec2 offset = point - cell;
  vec2 fade = offset * offset * offset * (offset * (offset * 6.0 - 15.0) + 10.0);
  float top = mix(
    glyphGradient(cell, offset, seed),
    glyphGradient(cell + vec2(1.0, 0.0), offset - vec2(1.0, 0.0), seed),
    fade.x
  );
  float bottom = mix(
    glyphGradient(cell + vec2(0.0, 1.0), offset - vec2(0.0, 1.0), seed),
    glyphGradient(cell + vec2(1.0, 1.0), offset - vec2(1.0, 1.0), seed),
    fade.x
  );
  return mix(top, bottom, fade.y);
}

float glyphFractalNoise(vec2 point, float seed) {
  float amplitude = 0.52;
  float frequency = 1.0;
  float total = 0.0;
  float range = 0.0;

  for (int octave = 0; octave < 4; octave += 1) {
    total += glyphPerlin(point * frequency, seed + float(octave) * 101.0) * amplitude;
    range += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return total / range;
}

float glyphSolarBrightness(vec2 cell, float time, float seed) {
  float seconds = time / 1000.0;
  float x = cell.x * 0.075;
  float y = cell.y * 0.075;
  float convection = glyphFractalNoise(
    vec2(x * 0.55 + seconds * 0.035, y * 0.55 - seconds * 0.025),
    seed + 211.0
  );
  float shear = glyphFractalNoise(
    vec2(x * 0.32 - seconds * 0.02, y * 0.32 + seconds * 0.03),
    seed + 353.0
  );
  float burstNoise = glyphFractalNoise(
    vec2(x * 0.72 - seconds * 0.11 + convection * 0.35, y * 0.72 + seconds * 0.09 + shear * 0.35),
    seed + 1201.0
  );
  float burst = smoothstep(0.48, 0.88, (burstNoise + 1.0) * 0.5);
  float displacement = convection * 2.4 + burst * 1.15;
  float arc = sin((x - y) * 1.65 + seconds * 0.62 + convection * 3.4) * (0.28 + burst * 0.95);
  float twistX = sin(y * 2.1 + seconds * 0.86 + shear * 4.2) * burst * 1.05;
  float twistY = cos(x * 1.9 - seconds * 0.74 + convection * 4.0) * burst * 0.92;
  float flowX = x + displacement + arc + twistX + sin(y * 1.3 + seconds * 0.45 + shear * 2.4) * 0.45;
  float flowY = y + shear * 1.85 - arc * 0.72 + twistY + cos(x * 1.1 - seconds * 0.38 + convection * 2.1) * 0.42;
  float plumeNoise = glyphFractalNoise(
    vec2(flowX * 0.95 - seconds * 0.24, flowY * 0.95 + seconds * 0.18),
    seed + 401.0
  );
  float filamentNoise = glyphFractalNoise(
    vec2(flowX * 2.6 + plumeNoise * 1.4 - seconds * 0.5, flowY * 1.8 - convection * 1.2 + seconds * 0.28),
    seed + 809.0
  );
  float cells = smoothstep(0.34, 0.78, (plumeNoise + 1.0) * 0.5);
  float filaments = smoothstep(0.5, 0.9, (filamentNoise + 1.0) * 0.5);
  float pulse = 0.5 + sin(seconds * 0.7 + convection * 3.2 + shear * 2.4) * 0.06 + burst * 0.12;
  float softCells = smoothstep(0.16, 0.82, (plumeNoise + 1.0) * 0.5);
  float coreCells = cells * cells;
  float depth = softCells * 0.28 + coreCells * 0.42 + filaments * 0.24 + burst * 0.18;

  return clamp(0.12 + (depth + (convection + 1.0) * 0.07) * pulse, 0.0, 1.0);
}

float glyphNoiseVisualBrightness(float brightness) {
  return clamp((brightness / ${NOISE_VISUAL_WHITE_POINT.toFixed(2)}) * u_visual_range, 0.0, 1.0);
}
`;

const createWebGlGlyphRenderer = ({
  canvas,
  cellHeight,
  cellWidth,
  characters,
  fontSize,
  gpuNoiseSeed,
}: {
  canvas: HTMLCanvasElement;
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  fontSize: number;
  gpuNoiseSeed?: number;
}): GlyphRenderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    stencil: false,
  });
  if (!gl) return null;

  const usesGpuNoise = gpuNoiseSeed !== undefined;
  const fragmentSource = usesGpuNoise
    ? `#version 300 es
    precision highp float;
    uniform sampler2D u_atlas;
    uniform sampler2D u_palette;
    uniform int u_color_count;
    in float v_brightness;
    in vec2 v_uv;
    out vec4 out_color;
    vec4 glyphPaletteColor(float brightness) {
      float palette_position = clamp(brightness, 0.0, 1.0) * float(u_color_count - 1);
      int lower_index = int(floor(palette_position));
      int upper_index = min(u_color_count - 1, lower_index + 1);
      vec4 lower_color = texelFetch(u_palette, ivec2(lower_index, 0), 0);
      vec4 upper_color = texelFetch(u_palette, ivec2(upper_index, 0), 0);

      return mix(lower_color, upper_color, fract(palette_position));
    }
    void main() {
      float alpha = texture(u_atlas, v_uv).a;
      vec4 color = glyphPaletteColor(v_brightness);
      out_color = vec4(color.rgb, color.a * alpha);
    }`
    : `#version 300 es
    precision mediump float;
    uniform sampler2D u_atlas;
    uniform sampler2D u_brightness;
    uniform sampler2D u_palette;
    uniform int u_color_count;
    in vec2 v_uv;
    in vec2 v_brightness_uv;
    out vec4 out_color;
    vec4 glyphPaletteColor(float brightness) {
      float palette_position = clamp(brightness, 0.0, 1.0) * float(u_color_count - 1);
      int lower_index = int(floor(palette_position));
      int upper_index = min(u_color_count - 1, lower_index + 1);
      vec4 lower_color = texelFetch(u_palette, ivec2(lower_index, 0), 0);
      vec4 upper_color = texelFetch(u_palette, ivec2(upper_index, 0), 0);

      return mix(lower_color, upper_color, fract(palette_position));
    }
    void main() {
      float alpha = texture(u_atlas, v_uv).a;
      float brightness = texture(u_brightness, v_brightness_uv).r;
      vec4 color = glyphPaletteColor(brightness);
      out_color = vec4(color.rgb, color.a * alpha);
    }`;

  const vertexSource = usesGpuNoise
    ? `#version 300 es
    in vec2 a_corner;
    in vec2 a_position;
    in float a_entropy_position;
    in float a_entropy_rate;
    in float a_entropy_scale;
    uniform float u_entropy_seed;
    uniform float u_glyph_count;
    uniform float u_noise_seed;
    uniform float u_source_time;
    uniform float u_entropy_sample_time;
    uniform float u_glyph_frame_rate;
    uniform float u_visual_range;
    uniform sampler2D u_field_modifier_brightness;
    uniform int u_field_modifier_count;
    uniform vec2 u_atlas_grid;
    uniform vec2 u_canvas_size;
    uniform vec2 u_cell_size;
    uniform vec2 u_grid_origin;
    uniform vec4 u_field_modifier_rects[${MAX_FIELD_MODIFIER_REGIONS}];
    uniform float u_field_modifier_blends[${MAX_FIELD_MODIFIER_REGIONS}];
    out float v_brightness;
    out vec2 v_uv;
    ${GLYPH_NOISE_GLSL}
    float hash(vec3 value) {
      value = fract(value * vec3(0.1031, 0.11369, 0.13787));
      value += dot(value, value.yxz + 19.19);
      return fract((value.x + value.y) * value.z);
    }
    float glyphBrightnessEntropy(float brightness) {
      return 0.04 + smoothstep(0.08, 0.92, brightness) * 0.24;
    }
    float glyphProceduralEntropyBrightness(float brightness) {
      return smoothstep(0.22, 0.78, brightness);
    }
    float glyphFieldModifierSample(int index, vec2 modifier_uv) {
      modifier_uv = clamp(modifier_uv, vec2(0.0), vec2(0.999999));
      float sample_x =
        (modifier_uv.x * float(${FIELD_MODIFIER_SAMPLE_SIZE - 1}) + 0.5) /
        float(${FIELD_MODIFIER_SAMPLE_SIZE});
      float sample_y =
        (float(index * ${FIELD_MODIFIER_SAMPLE_SIZE}) +
        modifier_uv.y * float(${FIELD_MODIFIER_SAMPLE_SIZE - 1}) + 0.5) /
        float(${FIELD_MODIFIER_SAMPLE_SIZE * MAX_FIELD_MODIFIER_REGIONS});
      return texture(u_field_modifier_brightness, vec2(sample_x, sample_y)).r;
    }
    float glyphFieldModifierBrightness(vec2 world) {
      float modifier_brightness = 0.0;

      for (int index = 0; index < ${MAX_FIELD_MODIFIER_REGIONS}; index += 1) {
        if (index >= u_field_modifier_count) break;

        vec4 rect = u_field_modifier_rects[index];
        float blend = u_field_modifier_blends[index];
        if (
          world.x < rect.x ||
          world.x >= rect.x + rect.z ||
          world.y < rect.y ||
          world.y >= rect.y + rect.w
        ) {
          continue;
        }

        vec2 modifier_uv = (world - rect.xy) / rect.zw;
        vec2 tap_offset = (u_cell_size * 0.25) / rect.zw;
        float sampled_brightness = 0.25 * (
          glyphFieldModifierSample(index, modifier_uv - tap_offset) +
          glyphFieldModifierSample(index, modifier_uv + vec2(tap_offset.x, -tap_offset.y)) +
          glyphFieldModifierSample(index, modifier_uv + vec2(-tap_offset.x, tap_offset.y)) +
          glyphFieldModifierSample(index, modifier_uv + tap_offset)
        );
        float mapped_brightness = smoothstep(
          0.0,
          ${FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT.toFixed(2)},
          sampled_brightness
        );
        float lifted_brightness =
          ${FIELD_MODIFIER_BRIGHTNESS_FLOOR.toFixed(2)} +
          mapped_brightness * ${Number(1 - FIELD_MODIFIER_BRIGHTNESS_FLOOR).toFixed(2)};
        modifier_brightness = max(modifier_brightness, lifted_brightness * blend);
      }

      return modifier_brightness;
    }
    float glyphApplyFieldModifiers(float brightness, vec2 world) {
      float modifier_brightness = glyphFieldModifierBrightness(world);

      return brightness + min(1.0, modifier_brightness * ${FIELD_MODIFIER_BRIGHTNESS_BOOST.toFixed(1)}) * (1.0 - brightness);
    }
    void main() {
      vec2 world = u_grid_origin + a_position + vec2(0.5) * u_cell_size;
      vec2 world_cell = floor(world / u_cell_size);
      vec2 field_point = world / u_cell_size;
      float color_brightness = glyphApplyFieldModifiers(
        glyphNoiseVisualBrightness(
          glyphSolarBrightness(field_point, u_source_time, u_noise_seed)
        ),
        world
      );
      float entropy_position =
        a_entropy_position +
        max(u_source_time - u_entropy_sample_time, 0.0) * 0.001 *
        u_glyph_frame_rate *
        a_entropy_rate *
        a_entropy_scale;
      float phase = hash(vec3(world_cell, u_entropy_seed));
      float epoch = floor(entropy_position + phase);
      float glyph_index = floor(hash(vec3(world_cell, epoch + u_entropy_seed)) * u_glyph_count);
      vec2 glyph_cell = vec2(mod(glyph_index, u_atlas_grid.x), floor(glyph_index / u_atlas_grid.x));
      vec2 pixel = a_position + a_corner * u_cell_size;
      vec2 clip = pixel / u_canvas_size * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_brightness = color_brightness;
      v_uv = (glyph_cell + a_corner) / u_atlas_grid;
    }`
    : `#version 300 es
    in vec2 a_corner;
    in vec2 a_position;
    in vec2 a_brightness_uv;
    in float a_entropy_position;
    in float a_entropy_rate;
    in float a_entropy_scale;
    uniform float u_entropy_seed;
    uniform float u_glyph_count;
    uniform float u_source_time;
    uniform float u_glyph_frame_rate;
    uniform float u_shader_entropy;
    uniform sampler2D u_brightness;
    uniform vec2 u_atlas_grid;
    uniform vec2 u_brightness_size;
    uniform vec2 u_canvas_size;
    uniform vec2 u_cell_size;
    out vec2 v_uv;
    out vec2 v_brightness_uv;
    float hash(vec3 value) {
      value = fract(value * vec3(0.1031, 0.11369, 0.13787));
      value += dot(value, value.yxz + 19.19);
      return fract((value.x + value.y) * value.z);
    }
    float glyphBrightnessEntropy(float brightness) {
      return 0.04 + smoothstep(0.08, 0.92, brightness) * 0.24;
    }
    void main() {
      vec2 cell = floor(a_brightness_uv * u_brightness_size);
      float brightness = texture(u_brightness, a_brightness_uv).r;
      float shader_entropy_position =
        u_source_time * 0.001 *
        u_glyph_frame_rate *
        a_entropy_rate *
        a_entropy_scale;
      float entropy_position = mix(a_entropy_position, shader_entropy_position, u_shader_entropy);
      float phase = hash(vec3(cell, u_entropy_seed));
      float epoch = floor(entropy_position + phase);
      float glyph_index = floor(hash(vec3(cell, epoch + u_entropy_seed)) * u_glyph_count);
      vec2 glyph_cell = vec2(mod(glyph_index, u_atlas_grid.x), floor(glyph_index / u_atlas_grid.x));
      vec2 pixel = a_position + a_corner * u_cell_size;
      vec2 clip = pixel / u_canvas_size * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_uv = (glyph_cell + a_corner) / u_atlas_grid;
      v_brightness_uv = a_brightness_uv;
    }`;

  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) return null;

  const vertexArray = gl.createVertexArray();
  const cornerBuffer = gl.createBuffer();
  const positionBuffer = gl.createBuffer();
  const brightnessUvBuffer = gl.createBuffer();
  const entropyPositionBuffer = gl.createBuffer();
  const entropyRateBuffer = gl.createBuffer();
  const entropyScaleBuffer = gl.createBuffer();
  const atlasTexture = gl.createTexture();
  const brightnessTexture = gl.createTexture();
  const fieldModifierBrightnessTexture = gl.createTexture();
  const paletteTexture = gl.createTexture();
  const cornerLocation = gl.getAttribLocation(program, "a_corner");
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const brightnessUvLocation = gl.getAttribLocation(program, "a_brightness_uv");
  const entropyPositionLocation = gl.getAttribLocation(program, "a_entropy_position");
  const entropyRateLocation = gl.getAttribLocation(program, "a_entropy_rate");
  const entropyScaleLocation = gl.getAttribLocation(program, "a_entropy_scale");
  const atlasGridLocation = gl.getUniformLocation(program, "u_atlas_grid");
  const brightnessSizeLocation = gl.getUniformLocation(program, "u_brightness_size");
  const canvasSizeLocation = gl.getUniformLocation(program, "u_canvas_size");
  const cellSizeLocation = gl.getUniformLocation(program, "u_cell_size");
  const gridOriginLocation = usesGpuNoise ? gl.getUniformLocation(program, "u_grid_origin") : null;
  const atlasLocation = gl.getUniformLocation(program, "u_atlas");
  const brightnessLocation = gl.getUniformLocation(program, "u_brightness");
  const fieldModifierBrightnessLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_brightness")
    : null;
  const fieldModifierCountLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_count")
    : null;
  const fieldModifierRectsLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_rects[0]")
    : null;
  const fieldModifierBlendsLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_blends[0]")
    : null;
  const paletteLocation = gl.getUniformLocation(program, "u_palette");
  const colorCountLocation = gl.getUniformLocation(program, "u_color_count");
  const entropySeedLocation = gl.getUniformLocation(program, "u_entropy_seed");
  const glyphCountLocation = gl.getUniformLocation(program, "u_glyph_count");
  const noiseSeedLocation = usesGpuNoise ? gl.getUniformLocation(program, "u_noise_seed") : null;
  const visualRangeLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_visual_range")
    : null;
  const sourceTimeLocation = gl.getUniformLocation(program, "u_source_time");
  const entropySampleTimeLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_entropy_sample_time")
    : null;
  const glyphFrameRateLocation = gl.getUniformLocation(program, "u_glyph_frame_rate");
  const shaderEntropyLocation = usesGpuNoise
    ? null
    : gl.getUniformLocation(program, "u_shader_entropy");

  if (
    !vertexArray ||
    !cornerBuffer ||
    !positionBuffer ||
    !brightnessUvBuffer ||
    !entropyPositionBuffer ||
    !entropyRateBuffer ||
    !entropyScaleBuffer ||
    !atlasTexture ||
    !brightnessTexture ||
    !fieldModifierBrightnessTexture ||
    !paletteTexture ||
    cornerLocation < 0 ||
    positionLocation < 0 ||
    (!usesGpuNoise && brightnessUvLocation < 0) ||
    entropyPositionLocation < 0 ||
    entropyRateLocation < 0 ||
    entropyScaleLocation < 0 ||
    !atlasGridLocation ||
    (!usesGpuNoise && !brightnessSizeLocation) ||
    !canvasSizeLocation ||
    !cellSizeLocation ||
    !atlasLocation ||
    (!usesGpuNoise && !brightnessLocation) ||
    (usesGpuNoise &&
      (!fieldModifierBrightnessLocation ||
        !fieldModifierCountLocation ||
        !fieldModifierBlendsLocation ||
        !fieldModifierRectsLocation ||
        !gridOriginLocation ||
        !visualRangeLocation)) ||
    !paletteLocation ||
    !colorCountLocation ||
    !entropySeedLocation ||
    !glyphCountLocation ||
    !sourceTimeLocation ||
    !glyphFrameRateLocation ||
    (usesGpuNoise && (!noiseSeedLocation || !entropySampleTimeLocation)) ||
    (!usesGpuNoise && !shaderEntropyLocation)
  ) {
    return null;
  }

  let brightnessUvs = new Float32Array();
  let brightnessBytes = new Uint8Array();
  let lastBrightnessTextureHeight = 0;
  let lastBrightnessTextureWidth = 0;
  let lastEntropyBufferLength = 0;
  let positions = new Float32Array();
  let lastPixelRatio = 0;
  let lastColorsKey = "";
  let lastFieldModifierVersion = -1;
  let lastPositionKey = "";
  const fieldModifierBrightnessBytes = new Uint8Array(
    FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE * MAX_FIELD_MODIFIER_REGIONS,
  );
  const fieldModifierRects = new Float32Array(MAX_FIELD_MODIFIER_REGIONS * 4);
  const fieldModifierBlends = new Float32Array(MAX_FIELD_MODIFIER_REGIONS);
  const atlasCols = Math.ceil(Math.sqrt(characters.length));
  const atlasRows = Math.ceil(characters.length / atlasCols);
  const entropySeed = Math.random() * 100000;

  gl.useProgram(program);
  gl.bindVertexArray(vertexArray);

  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, GLYPH_QUAD_CORNERS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(cornerLocation);
  gl.vertexAttribPointer(cornerLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(positionLocation, 1);

  if (brightnessUvLocation >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, brightnessUvBuffer);
    gl.enableVertexAttribArray(brightnessUvLocation);
    gl.vertexAttribPointer(brightnessUvLocation, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(brightnessUvLocation, 1);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, entropyPositionBuffer);
  gl.enableVertexAttribArray(entropyPositionLocation);
  gl.vertexAttribPointer(entropyPositionLocation, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(entropyPositionLocation, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, entropyRateBuffer);
  gl.enableVertexAttribArray(entropyRateLocation);
  gl.vertexAttribPointer(entropyRateLocation, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(entropyRateLocation, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, entropyScaleBuffer);
  gl.enableVertexAttribArray(entropyScaleLocation);
  gl.vertexAttribPointer(entropyScaleLocation, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(entropyScaleLocation, 1);

  gl.uniform1i(atlasLocation, 0);
  if (brightnessLocation) {
    gl.uniform1i(brightnessLocation, 2);
  }
  if (fieldModifierBrightnessLocation) {
    gl.uniform1i(fieldModifierBrightnessLocation, 3);
  }
  gl.uniform1i(paletteLocation, 1);
  gl.uniform1f(entropySeedLocation, entropySeed);
  gl.uniform1f(glyphCountLocation, characters.length);
  gl.uniform2f(atlasGridLocation, atlasCols, atlasRows);
  gl.uniform2f(cellSizeLocation, cellWidth, cellHeight);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uploadAtlas = (pixelRatio: number): void => {
    const atlas = createGlyphAtlas({ cellHeight, cellWidth, characters, fontSize, pixelRatio });

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  };

  const uploadPalette = (colors: string[]): void => {
    const palette = new Uint8Array(colors.length * 4);

    for (let index = 0; index < colors.length; index += 1) {
      const [red, green, blue, alpha] = parseColor(colors[index]);
      const valueIndex = index * 4;

      palette[valueIndex] = Math.round(red * 255);
      palette[valueIndex + 1] = Math.round(green * 255);
      palette[valueIndex + 2] = Math.round(blue * 255);
      palette[valueIndex + 3] = Math.round(alpha * 255);
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      colors.length,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      palette,
    );
    gl.useProgram(program);
    gl.uniform1i(colorCountLocation, colors.length);
  };

  const uploadBrightness = (brightnessValues: Float32Array, cols: number, rows: number): void => {
    const didResize = cols !== lastBrightnessTextureWidth || rows !== lastBrightnessTextureHeight;

    if (brightnessBytes.length !== brightnessValues.length) {
      brightnessBytes = new Uint8Array(brightnessValues.length);
    }

    for (let index = 0; index < brightnessValues.length; index += 1) {
      brightnessBytes[index] = Math.round(clamp(brightnessValues[index], 0, 1) * 255);
    }

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, brightnessTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (didResize) {
      lastBrightnessTextureWidth = cols;
      lastBrightnessTextureHeight = rows;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        cols,
        rows,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        brightnessBytes,
      );
      return;
    }

    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.UNSIGNED_BYTE, brightnessBytes);
  };

  const uploadFieldModifiers = (): void => {
    if (
      !usesGpuNoise ||
      !fieldModifierCountLocation ||
      !fieldModifierBlendsLocation ||
      !fieldModifierRectsLocation ||
      !fieldModifierBrightnessTexture
    ) {
      return;
    }

    if (lastFieldModifierVersion === glyphFieldModifierRegionsVersion) {
      return;
    }

    lastFieldModifierVersion = glyphFieldModifierRegionsVersion;

    const regions = Array.from(glyphFieldModifierRegions.values())
      .filter((region) => region.width > 0 && region.height > 0 && region.brightnessGrid)
      .slice(0, MAX_FIELD_MODIFIER_REGIONS);

    let regionCount = 0;

    fieldModifierBrightnessBytes.fill(0);
    fieldModifierBlends.fill(0);
    fieldModifierRects.fill(0);

    for (const region of regions) {
      const valueIndex = regionCount * 4;
      const brightnessOffset =
        regionCount * FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;

      fieldModifierRects[valueIndex] = region.documentLeft;
      fieldModifierRects[valueIndex + 1] = region.documentTop;
      fieldModifierRects[valueIndex + 2] = region.width;
      fieldModifierRects[valueIndex + 3] = region.height;
      fieldModifierBlends[regionCount] = region.blend;
      fieldModifierBrightnessBytes.set(region.brightnessGrid ?? [], brightnessOffset);
      regionCount += 1;
    }

    gl.useProgram(program);
    gl.uniform1i(fieldModifierCountLocation, regionCount);
    gl.uniform1fv(fieldModifierBlendsLocation, fieldModifierBlends);
    gl.uniform4fv(fieldModifierRectsLocation, fieldModifierRects);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, fieldModifierBrightnessTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      FIELD_MODIFIER_SAMPLE_SIZE,
      FIELD_MODIFIER_SAMPLE_SIZE * MAX_FIELD_MODIFIER_REGIONS,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      fieldModifierBrightnessBytes,
    );
  };

  const uploadEntropyPositions = (entropyValues: Float32Array, usage: number): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, entropyPositionBuffer);

    if (entropyValues.length !== lastEntropyBufferLength) {
      lastEntropyBufferLength = entropyValues.length;
      gl.bufferData(gl.ARRAY_BUFFER, entropyValues, usage);
      return;
    }

    gl.bufferSubData(gl.ARRAY_BUFFER, 0, entropyValues);
  };

  const uploadEntropyRates = (entropyRates: Float32Array): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, entropyRateBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, entropyRates, gl.DYNAMIC_DRAW);
  };

  const uploadEntropyScales = (entropyScales: Float32Array): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, entropyScaleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, entropyScales, gl.STATIC_DRAW);
  };

  return {
    draw: ({
      backgroundColor,
      brightnessValues,
      cellHeight,
      cellWidth,
      colors,
      cols,
      entropySampleTime,
      gpuNoiseSeed: stateGpuNoiseSeed,
      offsetX,
      offsetY,
      glyphEntropyPositions,
      glyphEntropyRates,
      glyphEntropyScales,
      glyphFrameRate,
      rows,
      entropyMode,
      shouldUpdateBrightness,
      shouldUploadEntropy,
      sourceTime,
      gridOriginX,
      gridOriginY,
      visualRange,
    }: GlyphRenderState): void => {
      const cellCount = cols * rows;
      const didResize = positions.length !== cellCount * 2;

      if (didResize) {
        brightnessUvs = new Float32Array(cellCount * 2);
        positions = new Float32Array(cellCount * 2);
        lastPositionKey = "";
      }

      const colorsKey = colors.join("|");
      if (colorsKey !== lastColorsKey) {
        lastColorsKey = colorsKey;
        uploadPalette(colors);
      }

      const positionKey = [cols, rows, offsetX, offsetY, cellWidth, cellHeight].join(":");
      const shouldUploadPositions = positionKey !== lastPositionKey;
      const shouldUploadBrightness = didResize || shouldUpdateBrightness;
      if (shouldUploadPositions) {
        lastPositionKey = positionKey;
      }

      if (shouldUploadPositions) {
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const index = row * cols + col;
            const positionIndex = index * 2;

            brightnessUvs[positionIndex] = (col + 0.5) / cols;
            brightnessUvs[positionIndex + 1] = (row + 0.5) / rows;
            positions[positionIndex] = offsetX + col * cellWidth;
            positions[positionIndex + 1] = offsetY + row * cellHeight;
          }
        }
      }

      const [red, green, blue, alpha] = parseColor(backgroundColor);
      gl.clearColor(red, green, blue, alpha);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vertexArray);
      gl.uniform2f(brightnessSizeLocation, cols, rows);
      gl.uniform2f(cellSizeLocation, cellWidth, cellHeight);

      if (
        usesGpuNoise &&
        noiseSeedLocation &&
        sourceTimeLocation &&
        entropySampleTimeLocation &&
        glyphFrameRateLocation &&
        visualRangeLocation
      ) {
        gl.uniform1f(noiseSeedLocation, stateGpuNoiseSeed ?? 0);
        gl.uniform1f(sourceTimeLocation, sourceTime);
        gl.uniform1f(entropySampleTimeLocation, entropySampleTime);
        gl.uniform1f(glyphFrameRateLocation, glyphFrameRate);
        gl.uniform1f(visualRangeLocation, visualRange);
        gl.uniform2f(gridOriginLocation, gridOriginX, gridOriginY);
        uploadFieldModifiers();
      } else if (
        !usesGpuNoise &&
        sourceTimeLocation &&
        glyphFrameRateLocation &&
        shaderEntropyLocation
      ) {
        gl.uniform1f(sourceTimeLocation, sourceTime);
        gl.uniform1f(glyphFrameRateLocation, glyphFrameRate);
        gl.uniform1f(shaderEntropyLocation, entropyMode === "shader" ? 1 : 0);
      }

      if (shouldUploadPositions || shouldUploadEntropy) {
        uploadEntropyScales(glyphEntropyScales);
      }

      if (shouldUploadPositions || shouldUpdateBrightness || shouldUploadEntropy) {
        uploadEntropyRates(glyphEntropyRates);
      }

      if (usesGpuNoise) {
        if (shouldUpdateBrightness || shouldUploadEntropy) {
          uploadEntropyPositions(glyphEntropyPositions, gl.DYNAMIC_DRAW);
        }
      } else if (shouldUploadPositions || entropyMode === "cpu") {
        uploadEntropyPositions(glyphEntropyPositions, gl.DYNAMIC_DRAW);
      }

      if (shouldUploadPositions) {
        gl.bindBuffer(gl.ARRAY_BUFFER, brightnessUvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, brightnessUvs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      }

      if (!usesGpuNoise && shouldUploadBrightness) {
        uploadBrightness(brightnessValues, cols, rows);
      }

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cellCount);
    },
    resize: ({ cssHeight, cssWidth, pixelRatio }: GlyphRenderSize): void => {
      canvas.width = cssWidth * pixelRatio;
      canvas.height = cssHeight * pixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform2f(canvasSizeLocation, cssWidth, cssHeight);

      if (pixelRatio !== lastPixelRatio) {
        lastPixelRatio = pixelRatio;
        uploadAtlas(pixelRatio);
      }
    },
    supportsShaderEntropy: true,
    usesGpuGlyphSelection: true,
  };
};

const createGpuNoiseGlyphRenderer = ({
  canvas,
  cellHeight,
  cellWidth,
  characters,
  fontSize,
  gpuNoiseSeed,
}: {
  canvas: HTMLCanvasElement;
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  fontSize: number;
  gpuNoiseSeed: number;
}): GlyphRenderer | null => {
  const gpuRenderer = createWebGlGlyphRenderer({
    canvas,
    cellHeight,
    cellWidth,
    characters,
    fontSize,
    gpuNoiseSeed,
  });
  if (!gpuRenderer) return null;

  const fallbackRenderer = createWebGlGlyphRenderer({
    canvas,
    cellHeight,
    cellWidth,
    characters,
    fontSize,
  });
  const gl = canvas.getContext("webgl2");
  let didCheckGpuNoise = false;
  let useFallback = false;

  if (!fallbackRenderer || !gl) return gpuRenderer;

  return {
    draw: (state: GlyphRenderState): void => {
      if (useFallback) {
        fallbackRenderer.draw({ ...state, gpuNoiseSeed: undefined });
        return;
      }

      gpuRenderer.draw(state);

      if (!didCheckGpuNoise) {
        didCheckGpuNoise = true;

        if (
          !hasVisibleRasterPixels(
            gl,
            Math.min(canvas.width, 512),
            Math.min(canvas.height, 512),
            state.backgroundColor,
          )
        ) {
          useFallback = true;
          fallbackRenderer.draw({ ...state, gpuNoiseSeed: undefined });
        }
      }
    },
    resize: (size: GlyphRenderSize): void => {
      gpuRenderer.resize(size);
      fallbackRenderer.resize(size);
      didCheckGpuNoise = false;
      useFallback = false;
    },
    get supportsShaderEntropy() {
      return !useFallback && gpuRenderer.supportsShaderEntropy === true;
    },
    usesGpuGlyphSelection: true,
  };
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
    const resolvedCharacters = Array.from(new Set(GLYPH_CHARS));
    const style = `--glyph-raster-color: ${preset.backgroundColor};`;
    const classes = className ? `${className} ` : "";

    useStylesScoped$(styles);

    useVisibleTask$(async ({ cleanup }): Promise<void> => {
      let isDocumentVisible = document.visibilityState === "visible";
      let isCleanedUp = false;
      let isRasterVisible = preset.layout === "fixed";
      let activeRaster: ActiveGlyphRaster | null = null;
      let removeResize = (): void => {};
      let removeBlendObserver = (): void => {};
      let removeVisibilityListener = (): void => {};
      let removeVisibilityObserver = (): void => {};
      const runtimePreset = resolveRuntimePreset(preset);

      cleanup(() => {
        isCleanedUp = true;
        if (activeRaster) {
          activeGlyphRasters.delete(activeRaster);
        }
        removeResize();
        removeBlendObserver();
        removeVisibilityListener();
        removeVisibilityObserver();
      });

      if (resolvedSource.type === "frames") {
        const element = document.getElementById(rasterId);
        if (!element) return;

        let frameAspectRatio = 0;
        const readFrameFitBounds = ():
          | {
              height: number;
              left: number;
              top: number;
              width: number;
            }
          | undefined => {
          if (preset.layout === "fixed") {
            const viewport = window.visualViewport;

            return {
              height: viewport?.height ?? window.innerHeight,
              left: viewport?.offsetLeft ?? 0,
              top: viewport?.offsetTop ?? 0,
              width: viewport?.width ?? window.innerWidth,
            };
          }

          const parentBounds = element.parentElement?.getBoundingClientRect();
          if (!parentBounds) return undefined;

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
            if (isCleanedUp) return;

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
                if (lastFrameAt !== 0 && time - lastFrameAt < 1000 / frameRate) return;

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
            activeGlyphRasters.add(activeRaster);
            scheduleActiveGlyphRasters();
          })
          .catch(() => {});
        animationFrame = requestAnimationFrame(onNextFrame);
        resizeObserver.observe(element);
        window.addEventListener("load", onWindowChanged);
        window.addEventListener("resize", onWindowChanged);
        window.visualViewport?.addEventListener("resize", onWindowChanged);
        window.visualViewport?.addEventListener("scroll", onWindowChanged);
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
          window.visualViewport?.removeEventListener("resize", onWindowChanged);
          window.visualViewport?.removeEventListener("scroll", onWindowChanged);
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
              isRasterVisible = Boolean(entry?.isIntersecting);
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

      const canvas = document.getElementById(rasterId) as HTMLCanvasElement | null;
      if (!canvas) return;

      const adapter = createNoiseAdapter();
      const gpuNoiseSeed = adapter.gpuNoiseSeed;
      const renderer =
        (gpuNoiseSeed === undefined
          ? null
          : createGpuNoiseGlyphRenderer({
              canvas,
              cellHeight: runtimePreset.cellHeight,
              cellWidth: runtimePreset.cellWidth,
              characters: resolvedCharacters,
              fontSize: runtimePreset.fontSize,
              gpuNoiseSeed,
            })) ??
        createWebGlGlyphRenderer({
          canvas,
          cellHeight: runtimePreset.cellHeight,
          cellWidth: runtimePreset.cellWidth,
          characters: resolvedCharacters,
          fontSize: runtimePreset.fontSize,
        }) ??
        createCanvasGlyphRenderer(canvas, runtimePreset.fontSize);
      if (!renderer) return;

      const usesGpuGlyphSelection = renderer.usesGpuGlyphSelection === true;
      let cols = 0;
      let rows = 0;
      let changedGlyphCount = 0;
      let changedGlyphIndices = new Uint32Array();
      let brightnessValues = new Float32Array();
      let cellHeight = runtimePreset.cellHeight;
      let cellWidth = runtimePreset.cellWidth;
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
        if (resolvedCharacters.length < 2) return currentIndex;

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

        cellHeight = grid.cellHeight;
        cellWidth = grid.cellWidth;
        cols = grid.cols;
        rows = grid.rows;
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

        adapter.resize?.(cols, rows);
        scheduleActiveGlyphRasters();
      };

      // The document-anchored canvas keeps a document position so the
      // compositor scrolls it in lockstep with the page; its height covers
      // the viewport plus overscan, clamped to the document so it never
      // extends the scrollable area.
      const updateCanvasHeight = (): void => {
        if (canvasAnchorMode !== "document") return;

        documentHeight = Math.max(document.documentElement.scrollHeight, largeViewportHeight);

        const overscanHeight = Math.round(largeViewportHeight * DOCUMENT_ANCHOR_OVERSCAN);
        const nextHeight = `${Math.min(overscanHeight, Math.floor(documentHeight))}px`;

        if (canvas.style.height !== nextHeight) {
          canvas.style.height = nextHeight;
        }
      };

      const applyAnchorMode = (mode: "document" | "viewport"): void => {
        if (canvasAnchorMode === mode) return;

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
        if (!canRender()) return;

        const frameRate = clamp(
          adapter.defaultFps ?? DEFAULT_FRAME_RATE,
          MIN_FRAME_RATE,
          MAX_FRAME_RATE,
        );
        // The GPU noise raster draws every animation frame so the
        // document-anchored field never trails the compositor-scrolled page
        // on high-refresh displays; noise time is quantized separately.
        const rendersAtDisplayRate =
          resolvedSource.type === "procedural-noise" && gpuNoiseSeed !== undefined;

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
          gpuNoiseSeed !== undefined;
        const shouldSampleBrightness =
          !shouldThrottleBrightnessSamples ||
          lastBrightnessSampleAt === 0 ||
          time - lastBrightnessSampleAt >= 1000 / PROCEDURAL_ENTROPY_SAMPLE_RATE;
        const shouldUpdateBrightness = shouldSampleBrightness;
        const isInitialBrightnessSample = lastBrightnessSampleAt === 0;
        const usesDocumentAnchor =
          anchor !== "viewport" &&
          (anchor === "document" || (entropyMode === "shader" && gpuNoiseSeed !== undefined));

        applyAnchorMode(usesDocumentAnchor ? "document" : "viewport");

        if (usesDocumentAnchor && shouldUpdateBrightness) {
          // Follow late document growth (images, fonts) at the sample cadence.
          updateCanvasHeight();
          resize();
        }

        const viewportScrollY = window.scrollY;
        const viewportHeight = window.innerHeight;

        // The compositor scrolls the document-anchored canvas in lockstep
        // with the page; the main thread only re-centers it (in whole grid
        // rows, shifting the entropy state to match) when scroll gets close
        // to an edge of its overscan.
        let shouldUploadEntropy = false;

        if (usesDocumentAnchor) {
          const edgeMargin = viewportHeight * DOCUMENT_ANCHOR_EDGE_MARGIN;
          const canvasBottom = canvasTop + lastCssHeight;
          const isNearTop = canvasTop > 0 && viewportScrollY < canvasTop + edgeMargin;
          const isNearBottom =
            canvasBottom < documentHeight - cellHeight &&
            viewportScrollY + viewportHeight > canvasBottom - edgeMargin;

          if (isNearTop || isNearBottom) {
            documentHeight = Math.max(document.documentElement.scrollHeight, largeViewportHeight);

            const maxTopRow = Math.max(0, Math.floor((documentHeight - lastCssHeight) / cellHeight));
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
        // sampled once per block of cells and only for rows near the
        // viewport; the display paths still sample every cell.
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
                let brightness: number;

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
                    applyGlyphFieldModifierBrightness(baseBrightness, worldX, worldY),
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
          resolvedSource.type === "procedural-noise" && gpuNoiseSeed !== undefined
            ? quantizeTime(sourceTime, PROCEDURAL_VISUAL_SAMPLE_RATE)
            : sourceTime;

        // A document-anchored canvas shows the same pixels regardless of
        // scroll, so only redraw when something it renders has changed.
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
            entropySampleTime: lastEntropySampleSourceTime,
            gpuNoiseSeed,
            glyphCharacters: resolvedCharacters,
            glyphEntropyPositions,
            glyphEntropyRates,
            glyphEntropyScales,
            glyphIndices,
            glyphFrameRate: frameRate,
            offsetX,
            offsetY,
            rows,
            entropyMode,
            shouldUpdateBrightness,
            shouldUploadEntropy,
            sourceTime: renderSourceTime,
            gridOriginX,
            gridOriginY,
            visualRange,
          });
        }

        if (adapter.frameCount) {
          framePosition = (framePosition + elapsedFrames) % adapter.frameCount;
        }
      };

      activeRaster = { canRender, render };
      activeGlyphRasters.add(activeRaster);
      largeViewportHeight = readLargeViewportHeight();
      applyAnchorMode(
        gpuNoiseSeed !== undefined && renderer.supportsShaderEntropy === true
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
            isRasterVisible = Boolean(entry?.isIntersecting);
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
          ? frameFit === "cover"
            ? "position: fixed; left: 50%; top: 50%; width: max(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))); height: calc(max(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))) / var(--glyph-raster-frame-aspect, 1)); transform: translate(-50%, -50%); transform-origin: center center; display: block; pointer-events: none;"
            : "position: fixed; left: 50%; top: 50%; width: min(100vw, calc(100vh * var(--glyph-raster-frame-aspect, 1))); height: min(100vh, calc(100vw / var(--glyph-raster-frame-aspect, 1))); transform: translate(-50%, -50%); transform-origin: center center; display: block; pointer-events: none;"
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
