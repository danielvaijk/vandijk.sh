export type ActiveGlyphRaster = {
  canRender: () => boolean;
  render: (time: number) => void;
};

const activeGlyphRasters = new Set<ActiveGlyphRaster>();
let activeGlyphRasterFrame = 0;

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

export const scheduleActiveGlyphRasters = (): void => {
  if (activeGlyphRasterFrame !== 0 || !hasActiveGlyphRaster()) return;

  activeGlyphRasterFrame = requestAnimationFrame(renderActiveGlyphRasters);
};

export const addActiveGlyphRaster = (raster: ActiveGlyphRaster): void => {
  activeGlyphRasters.add(raster);
};

export const removeActiveGlyphRaster = (raster: ActiveGlyphRaster): void => {
  activeGlyphRasters.delete(raster);
};
