import type { GlyphRasterSource } from "src/vfx/glyph-raster/source";
import { clamp, lerp, smoothstep } from "src/vfx/shared/math";

export { clamp, lerp, smoothstep } from "src/vfx/shared/math";

export type GlyphRasterLayout = "fill" | "fixed";

export type GlyphRasterPreset = {
  backgroundColor: string;
  cellHeight: number;
  cellWidth: number;
  colors: string[];
  fontSize: number;
  layout: GlyphRasterLayout;
};

export const GLYPH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
export const GLYPH_COLORS = ["#2e2e2e", "#585858", "#8a8a8a", "#d0d0d0", "#f4f4f4"];
export const NOISE_COLORS = ["#070707", "#151515", "#303030", "#747474", "#ffffff"];
export const NOISE_CELL_WIDTH = 8;
export const NOISE_CELL_HEIGHT = 14;
export const NOISE_FONT_SIZE = 13;
export const DEFAULT_FRAME_RATE = 18;
export const MIN_FRAME_RATE = 1;
export const MAX_FRAME_RATE = 60;
export const PROCEDURAL_ENTROPY_SAMPLE_RATE = 9;
export const PROCEDURAL_VISUAL_SAMPLE_RATE = 30;
export const GLYPH_ENTROPY_RATE_EASE_SECONDS = 0.35;
export const DOCUMENT_ANCHOR_OVERSCAN = 2.5;
export const DOCUMENT_ANCHOR_EDGE_MARGIN = 0.35;
export const MIN_GLYPH_CELL_SCALE = 1;
export const MAX_GLYPH_CELL_SCALE = 8;
export const MAX_GLYPH_GRID_CELLS = 18000;

export const resolvePreset = (
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

export const resolveGlyphGrid = ({
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

export const shiftGridRows = (values: Float32Array, cols: number, deltaRows: number): void => {
  const offset = Math.abs(deltaRows) * cols;

  if (deltaRows > 0) {
    values.copyWithin(0, offset);
  } else {
    values.copyWithin(offset, 0, values.length - offset);
  }
};

export const quantizeTime = (time: number, sampleRate: number): number => {
  const interval = 1000 / sampleRate;

  return Math.floor(time / interval) * interval;
};

export const entropyRateForBrightness = (brightness: number): number => {
  const entropyBrightness = smoothstep(0.22, 0.78, brightness);

  return 0.04 + smoothstep(0.08, 0.92, entropyBrightness) * 0.24;
};

export const easeEntropyRate = (
  currentRate: number,
  targetRate: number,
  elapsedMilliseconds: number,
): number => {
  const amount = 1 - Math.exp(-(elapsedMilliseconds / 1000) / GLYPH_ENTROPY_RATE_EASE_SECONDS);

  return lerp(currentRate, targetRate, amount);
};

export const shouldRefreshCharacter = (entropyRate: number): boolean => Math.random() < entropyRate;
