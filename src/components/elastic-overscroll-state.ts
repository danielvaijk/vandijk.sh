// Shared between the overscroll gesture handler and the glyph rasters so the
// procedural noise field can shift in lockstep with the elastically
// translated page content.
let elasticOverscrollOffset = 0;

export const getElasticOverscrollOffset = (): number => elasticOverscrollOffset;

export const setElasticOverscrollOffset = (offset: number): void => {
  elasticOverscrollOffset = offset;
};
