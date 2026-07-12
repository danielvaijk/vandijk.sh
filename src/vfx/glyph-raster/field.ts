import { FIELD_MODIFIER_SAMPLE_SIZE } from "src/vfx/glyph-raster/config";

interface GlyphFieldModifierRegion {
  blend: number;
  brightnessGrid?: Uint8Array;
  documentLeft: number;
  documentTop: number;
  height: number;
  width: number;
}

export { FIELD_MODIFIER_SAMPLE_SIZE, type GlyphFieldModifierRegion };
