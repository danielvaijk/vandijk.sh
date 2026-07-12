import proceduralFragmentSource from "src/vfx/glyph-raster/shaders/glyph-raster-procedural.frag.glsl?raw";
import frameFragmentSource from "src/vfx/glyph-raster/shaders/glyph-raster-frame.frag.glsl?raw";
import proceduralVertexSource from "src/vfx/glyph-raster/shaders/glyph-raster-procedural.vert.glsl?raw";
import frameVertexSource from "src/vfx/glyph-raster/shaders/glyph-raster-frame.vert.glsl?raw";
import solarNoiseSource from "src/vfx/solar-noise/shaders/solar-noise.glsl?raw";

export type GlyphRasterShaderOptions = {
  fieldModifierBrightnessBoost: number;
  fieldModifierBrightnessFloor: number;
  fieldModifierBrightnessWhitePoint: number;
  fieldModifierSampleSize: number;
  maxFieldModifierRegions: number;
  noiseVisualWhitePoint: number;
  usesGpuNoise: boolean;
};

export type GlyphRasterShaderSources = {
  fragmentSource: string;
  vertexSource: string;
};

const withShaderDefines = (
  source: string,
  {
    fieldModifierBrightnessBoost,
    fieldModifierBrightnessFloor,
    fieldModifierBrightnessWhitePoint,
    fieldModifierSampleSize,
    maxFieldModifierRegions,
    noiseVisualWhitePoint,
  }: Omit<GlyphRasterShaderOptions, "usesGpuNoise">,
): string => {
  const defines = [
    "#define GLYPH_FIELD_MODIFIER_BRIGHTNESS_BOOST " + fieldModifierBrightnessBoost.toFixed(1),
    "#define GLYPH_FIELD_MODIFIER_BRIGHTNESS_FLOOR " + fieldModifierBrightnessFloor.toFixed(2),
    "#define GLYPH_FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT " +
      fieldModifierBrightnessWhitePoint.toFixed(2),
    "#define GLYPH_FIELD_MODIFIER_SAMPLE_SIZE " + fieldModifierSampleSize,
    "#define GLYPH_MAX_FIELD_MODIFIER_REGIONS " + maxFieldModifierRegions,
    "#define GLYPH_NOISE_VISUAL_WHITE_POINT " + noiseVisualWhitePoint.toFixed(2),
  ].join("\n");

  return source.replace("#version 300 es", "#version 300 es\n" + defines);
};

export const createGlyphRasterShaderSources = ({
  usesGpuNoise,
  ...options
}: GlyphRasterShaderOptions): GlyphRasterShaderSources => {
  const vertexSource = usesGpuNoise
    ? proceduralVertexSource.replace("// SOLAR_NOISE_PLACEHOLDER", solarNoiseSource)
    : frameVertexSource;
  const fragmentSource = usesGpuNoise ? proceduralFragmentSource : frameFragmentSource;

  return {
    fragmentSource: withShaderDefines(fragmentSource, options),
    vertexSource: withShaderDefines(vertexSource, options),
  };
};
