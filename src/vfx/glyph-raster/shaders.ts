import proceduralFragmentSource from "src/vfx/glyph-raster/shaders/glyph-raster-procedural.frag.glsl?raw";
import proceduralVertexSource from "src/vfx/glyph-raster/shaders/glyph-raster-procedural.vert.glsl?raw";
import solarNoiseSource from "src/vfx/solar-noise/shaders/solar-noise.glsl?raw";

interface GlyphRasterShaderOptions {
  fieldModifierBrightnessBoost: number;
  fieldModifierBrightnessFloor: number;
  fieldModifierBrightnessWhitePoint: number;
  fieldModifierSampleSize: number;
  maxFieldModifierRegions: number;
  noiseVisualWhitePoint: number;
}

interface GlyphRasterShaderSources {
  fragmentSource: string;
  vertexSource: string;
}

function withShaderDefines(
  source: string,
  {
    fieldModifierBrightnessBoost,
    fieldModifierBrightnessFloor,
    fieldModifierBrightnessWhitePoint,
    fieldModifierSampleSize,
    maxFieldModifierRegions,
    noiseVisualWhitePoint,
  }: GlyphRasterShaderOptions,
): string {
  const defines = [
    `#define GLYPH_FIELD_MODIFIER_BRIGHTNESS_BOOST ${fieldModifierBrightnessBoost.toFixed(1)}`,
    `#define GLYPH_FIELD_MODIFIER_BRIGHTNESS_FLOOR ${fieldModifierBrightnessFloor.toFixed(2)}`,
    `#define GLYPH_FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT ${fieldModifierBrightnessWhitePoint.toFixed(
      2,
    )}`,
    `#define GLYPH_FIELD_MODIFIER_SAMPLE_SIZE ${fieldModifierSampleSize}`,
    `#define GLYPH_MAX_FIELD_MODIFIER_REGIONS ${maxFieldModifierRegions}`,
    `#define GLYPH_NOISE_VISUAL_WHITE_POINT ${noiseVisualWhitePoint.toFixed(2)}`,
  ].join("\n");

  return source.replace("#version 300 es", `#version 300 es\n${defines}`);
}

function createGlyphRasterShaderSources(
  options: GlyphRasterShaderOptions,
): GlyphRasterShaderSources {
  const vertexSource = proceduralVertexSource.replace(
    "// SOLAR_NOISE_PLACEHOLDER",
    solarNoiseSource,
  );

  return {
    fragmentSource: withShaderDefines(proceduralFragmentSource, options),
    vertexSource: withShaderDefines(vertexSource, options),
  };
}

export {
  createGlyphRasterShaderSources,
  type GlyphRasterShaderOptions,
  type GlyphRasterShaderSources,
};
