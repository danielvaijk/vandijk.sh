export interface GlyphRasterFrameGrid {
  cols: number;
  rows?: number;
}

export interface GlyphRasterFrameOptions {
  cellHeight: number;
  cellWidth: number;
  grids: {
    articleCover: GlyphRasterFrameGrid;
    articleImage: GlyphRasterFrameGrid;
    viewport: GlyphRasterFrameGrid;
  };
  horizontalScale: number;
}

export const GLYPH_RASTER_FRAME_OPTIONS: GlyphRasterFrameOptions = {
  cellHeight: 14,
  cellWidth: 8,
  grids: {
    // These are the highest-density (mobile) glyph grids. Desktop uses
    // larger cells and therefore samples down from the same frame source.
    articleCover: { cols: 115, rows: 38 },
    articleImage: { cols: 115, rows: 45 },
    viewport: { cols: 200 },
  },
  horizontalScale: 1.09,
};
