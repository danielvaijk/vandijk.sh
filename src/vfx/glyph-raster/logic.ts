import { clamp } from "src/vfx/shared/math";
import type { GlyphRasterSource } from "src/vfx/glyph-raster/source";

export type GlyphRasterLayout = "fill" | "fixed";

interface GlyphRasterPreset {
  backgroundColor: string;
  cellHeight: number;
  cellWidth: number;
  colors: string[];
  fontSize: number;
  layout: GlyphRasterLayout;
}

interface GlyphFieldGridGeometry {
  cellHeight: number;
  cellWidth: number;
  originX: number;
  originY: number;
}

interface GlyphFieldModifierBounds {
  documentLeft: number;
  documentTop: number;
  height: number;
  width: number;
}

const GLYPH_CHARS = String.raw`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\<>`;
const GLYPH_COLORS = ["#2e2e2e", "#585858", "#8a8a8a", "#d0d0d0", "#f4f4f4"];
const NOISE_COLORS = ["#070707", "#151515", "#303030", "#747474", "#ffffff"];
const NOISE_CELL_WIDTH = 8;
const NOISE_CELL_HEIGHT = 14;
const NOISE_FONT_SIZE = 13;
const DEFAULT_FRAME_RATE = 18;
const MIN_FRAME_RATE = 1;
const MAX_FRAME_RATE = 60;
const PROCEDURAL_VISUAL_SAMPLE_RATE = 30;
const DOCUMENT_ANCHOR_OVERSCAN = 2.5;
const DOCUMENT_ANCHOR_EDGE_MARGIN = 0.35;
const MIN_GLYPH_CELL_SCALE = 1;
const MAX_GLYPH_CELL_SCALE = 8;
const MAX_GLYPH_GRID_CELLS = 18_000;

function resolvePreset(
  source: GlyphRasterSource,
  layout: GlyphRasterLayout | undefined,
): GlyphRasterPreset {
  return {
    backgroundColor: "#050505",
    cellHeight: NOISE_CELL_HEIGHT,
    cellWidth: NOISE_CELL_WIDTH,
    colors: source.type === "procedural-noise" ? NOISE_COLORS : GLYPH_COLORS,
    fontSize: NOISE_FONT_SIZE,
    layout: layout ?? "fixed",
  };
}

function resolveGlyphGrid({
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
} {
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
  // Shifted by the fractional scroll offset to stay anchored to the document.
  return {
    cellHeight: resolvedCellHeight,
    cellWidth: resolvedCellWidth,
    cols: Math.max(1, Math.ceil(cssWidth / resolvedCellWidth)) + 1,
    rows: Math.max(1, Math.ceil(cssHeight / resolvedCellHeight)) + 1,
  };
}

// The shader includes a glyph by its center point. Resolve the exact outer
// Cell boundaries of that same selection so the modifier texture never ends
// Partway through a glyph quad.
function snapGlyphFieldModifierBounds(
  bounds: GlyphFieldModifierBounds,
  grid: GlyphFieldGridGeometry,
): GlyphFieldModifierBounds {
  const snapAxis = (
    start: number,
    length: number,
    origin: number,
    cellSize: number,
  ): { length: number; start: number } => {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      return { length, start };
    }

    const firstCell = Math.ceil((start - origin) / cellSize - 0.5);
    const exclusiveEndCell = Math.ceil((start + length - origin) / cellSize - 0.5);
    if (exclusiveEndCell <= firstCell) {
      return { length: cellSize, start: origin + firstCell * cellSize };
    }

    return {
      length: (exclusiveEndCell - firstCell) * cellSize,
      start: origin + firstCell * cellSize,
    };
  };
  const horizontal = snapAxis(bounds.documentLeft, bounds.width, grid.originX, grid.cellWidth);
  const vertical = snapAxis(bounds.documentTop, bounds.height, grid.originY, grid.cellHeight);

  return {
    documentLeft: horizontal.start,
    documentTop: vertical.start,
    height: vertical.length,
    width: horizontal.length,
  };
}

function quantizeTime(time: number, sampleRate: number): number {
  const interval = 1000 / sampleRate;

  return Math.floor(time / interval) * interval;
}

export {
  DEFAULT_FRAME_RATE,
  DOCUMENT_ANCHOR_EDGE_MARGIN,
  DOCUMENT_ANCHOR_OVERSCAN,
  GLYPH_CHARS,
  GLYPH_COLORS,
  MAX_FRAME_RATE,
  MAX_GLYPH_CELL_SCALE,
  MAX_GLYPH_GRID_CELLS,
  MIN_FRAME_RATE,
  MIN_GLYPH_CELL_SCALE,
  NOISE_CELL_HEIGHT,
  NOISE_CELL_WIDTH,
  NOISE_COLORS,
  NOISE_FONT_SIZE,
  PROCEDURAL_VISUAL_SAMPLE_RATE,
  resolveGlyphGrid,
  resolvePreset,
  snapGlyphFieldModifierBounds,
  quantizeTime,
};

export type { GlyphFieldGridGeometry, GlyphFieldModifierBounds, GlyphRasterPreset };
