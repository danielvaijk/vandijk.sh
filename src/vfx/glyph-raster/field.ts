export const FIELD_MODIFIER_SAMPLE_SIZE = 256;
export const FIELD_MODIFIER_BRIGHTNESS_BOOST = 1;
export const FIELD_MODIFIER_BRIGHTNESS_FLOOR = 0.07;
export const FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT = 1;

import { clamp, lerp, smoothstep } from "src/vfx/shared/math";

export type GlyphFieldModifierRegion = {
  blend: number;
  brightnessGrid?: Uint8Array;
  documentLeft: number;
  documentTop: number;
  height: number;
  width: number;
};

export const applyGlyphFieldModifierBrightness = (
  brightness: number,
  worldX: number,
  worldY: number,
  regions: Iterable<GlyphFieldModifierRegion>,
): number => {
  let modifierBrightness = 0;

  for (const region of regions) {
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
