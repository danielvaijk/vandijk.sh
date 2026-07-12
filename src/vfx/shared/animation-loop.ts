interface ActiveGlyphRaster {
  canRender: () => boolean;
  render: (time: number) => void;
}

const activeGlyphRasters = new Set<ActiveGlyphRaster>();
let activeGlyphRasterFrame = 0;

function hasActiveGlyphRaster(): boolean {
  for (const raster of activeGlyphRasters) {
    if (raster.canRender()) {
      return true;
    }
  }

  return false;
}

function renderActiveGlyphRasters(time: number): void {
  // Keep the fired handle non-zero while rasters render so re-entrant
  // ScheduleActiveGlyphRasters() calls (e.g. resize() from within render)
  // Cannot arm a second, parallel rAF chain.
  for (const raster of activeGlyphRasters) {
    raster.render(time);
  }

  activeGlyphRasterFrame = hasActiveGlyphRaster()
    ? requestAnimationFrame(renderActiveGlyphRasters)
    : 0;
}

function scheduleActiveGlyphRasters(): void {
  if (activeGlyphRasterFrame !== 0 || !hasActiveGlyphRaster()) {
    return;
  }

  activeGlyphRasterFrame = requestAnimationFrame(renderActiveGlyphRasters);
}

function addActiveGlyphRaster(raster: ActiveGlyphRaster): void {
  activeGlyphRasters.add(raster);
}

function removeActiveGlyphRaster(raster: ActiveGlyphRaster): void {
  activeGlyphRasters.delete(raster);
}

export {
  addActiveGlyphRaster,
  removeActiveGlyphRaster,
  scheduleActiveGlyphRasters,
};

export type {
  ActiveGlyphRaster,
};
