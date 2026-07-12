import { createGlyphRasterShaderSources } from "src/vfx/glyph-raster/shaders";
import { clamp } from "src/vfx/shared/math";

export type GlyphEntropyMode = "cpu" | "shader";

export type GlyphRenderSize = {
  cssHeight: number;
  cssWidth: number;
  pixelRatio: number;
};

export type GlyphFieldModifierRegion = {
  blend: number;
  brightnessGrid?: Uint8Array;
  documentLeft: number;
  documentTop: number;
  height: number;
  width: number;
};

export type GlyphRenderState = {
  backgroundColor: string;
  brightnessValues: Float32Array;
  cellHeight: number;
  cellWidth: number;
  changedGlyphCount: number;
  changedGlyphIndices: Uint32Array;
  colors: string[];
  cols: number;
  entropySampleTime: number;
  gpuNoiseSeed?: number;
  glyphCharacters: string[];
  glyphEntropyPositions: Float32Array;
  glyphEntropyRates: Float32Array;
  glyphEntropyScales: Float32Array;
  glyphIndices: Uint16Array;
  glyphFrameRate: number;
  offsetX: number;
  offsetY: number;
  rows: number;
  entropyMode: GlyphEntropyMode;
  fieldModifierRegionsVersion: number;
  shouldUpdateBrightness: boolean;
  shouldUploadEntropy: boolean;
  sourceTime: number;
  gridOriginX: number;
  gridOriginY: number;
  visualRange: number;
};

export type GlyphRenderer = {
  draw: (state: GlyphRenderState) => void;
  resize: (size: GlyphRenderSize) => void;
  supportsShaderEntropy: boolean;
  usesGpuGlyphSelection: boolean;
};

const GLYPH_FONT_FAMILY = 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif';
const FIELD_MODIFIER_BRIGHTNESS_BOOST = 1;
const FIELD_MODIFIER_BRIGHTNESS_FLOOR = 0.07;
const FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT = 1;
const FIELD_MODIFIER_SAMPLE_SIZE = 256;
const MAX_FIELD_MODIFIER_REGIONS = 8;
const NOISE_VISUAL_WHITE_POINT = 0.63;
const MAX_GLYPH_ATLAS_CACHE_SIZE = 8;
const MAX_GLYPH_DRAW_METRICS_CACHE_SIZE = 512;
const MAX_PARSED_COLOR_CACHE_SIZE = 32;
const GLYPH_CELL_PADDING_RATIO = 0.08;
const GLYPH_QUAD_CORNERS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

const glyphAtlasCache = new Map<
  string,
  {
    canvas: HTMLCanvasElement;
    glyphUvs: Float32Array;
  }
>();
const glyphDrawMetricsCache = new Map<
  string,
  {
    offsetX: number;
    offsetY: number;
    scale: number;
  }
>();
const parsedColorCache = new Map<string, [number, number, number, number]>();

function getCachedValue<Value>(cache: Map<string, Value>, key: string): Value | undefined {
  const value = cache.get(key);
  if (value === undefined) return undefined;

  cache.delete(key);
  cache.set(key, value);

  return value;
}

function setCachedValue<Value>(
  cache: Map<string, Value>,
  key: string,
  value: Value,
  maxSize: number,
): void {
  cache.delete(key);
  cache.set(key, value);

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) return;

    cache.delete(oldestKey);
  }
}
const parseColor = (color: string): [number, number, number, number] => {
  const cachedColor = getCachedValue(parsedColorCache, color);
  if (cachedColor) return cachedColor;

  let parsedColor: [number, number, number, number];

  if (/^#[\da-f]{3}$/iu.test(color)) {
    parsedColor = [
      Number.parseInt(color[1] + color[1], 16) / 255,
      Number.parseInt(color[2] + color[2], 16) / 255,
      Number.parseInt(color[3] + color[3], 16) / 255,
      1,
    ];
  } else if (/^#[\da-f]{6}$/iu.test(color)) {
    parsedColor = [
      Number.parseInt(color.slice(1, 3), 16) / 255,
      Number.parseInt(color.slice(3, 5), 16) / 255,
      Number.parseInt(color.slice(5, 7), 16) / 255,
      1,
    ];
  } else {
    parsedColor = [1, 1, 1, 1];
  }

  setCachedValue(parsedColorCache, color, parsedColor, MAX_PARSED_COLOR_CACHE_SIZE);

  return parsedColor;
};

const compileShader = (
  gl: WebGL2RenderingContext,
  source: string,
  type: number,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

const createProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null => {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!vertexShader || !fragmentShader || !program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
};

const getGlyphDrawMetrics = (
  context: CanvasRenderingContext2D,
  glyph: string,
  cellWidth: number,
  cellHeight: number,
  fontSize: number,
): {
  offsetX: number;
  offsetY: number;
  scale: number;
} => {
  const cacheKey = [glyph, cellWidth, cellHeight, fontSize].join(":");
  const cachedMetrics = getCachedValue(glyphDrawMetricsCache, cacheKey);
  if (cachedMetrics) return cachedMetrics;

  const metrics = context.measureText(glyph);
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || fontSize;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const glyphWidth = Math.max(1, left + right);
  const glyphHeight = Math.max(1, ascent + descent);
  const paddingX = Math.max(0.5, cellWidth * GLYPH_CELL_PADDING_RATIO);
  const paddingY = Math.max(0.5, cellHeight * GLYPH_CELL_PADDING_RATIO);
  const scale = Math.min(
    1,
    Math.max(1, cellWidth - paddingX * 2) / glyphWidth,
    Math.max(1, cellHeight - paddingY * 2) / glyphHeight,
  );
  const offsetX = (cellWidth - glyphWidth * scale) / 2 + left * scale;
  const offsetY = (cellHeight - glyphHeight * scale) / 2 + ascent * scale;
  const resolvedMetrics = { offsetX, offsetY, scale };

  setCachedValue(
    glyphDrawMetricsCache,
    cacheKey,
    resolvedMetrics,
    MAX_GLYPH_DRAW_METRICS_CACHE_SIZE,
  );

  return resolvedMetrics;
};

const drawGlyphInCell = (
  context: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  cellWidth: number,
  cellHeight: number,
  fontSize: number,
): void => {
  const metrics = getGlyphDrawMetrics(context, glyph, cellWidth, cellHeight, fontSize);

  context.save();
  context.translate(x + metrics.offsetX, y + metrics.offsetY);
  context.scale(metrics.scale, metrics.scale);
  context.fillText(glyph, 0, 0);
  context.restore();
};

const createGlyphAtlas = ({
  cellHeight,
  cellWidth,
  characters,
  fontSize,
  pixelRatio,
}: {
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  fontSize: number;
  pixelRatio: number;
}): {
  canvas: HTMLCanvasElement;
  glyphUvs: Float32Array;
} => {
  const cacheKey = [cellHeight, cellWidth, characters.join(""), fontSize, pixelRatio].join(":");
  const cachedAtlas = getCachedValue(glyphAtlasCache, cacheKey);
  if (cachedAtlas) return cachedAtlas;

  const atlasCols = Math.ceil(Math.sqrt(characters.length));
  const atlasRows = Math.ceil(characters.length / atlasCols);
  const atlasCellWidth = Math.max(1, Math.ceil(cellWidth * pixelRatio));
  const atlasCellHeight = Math.max(1, Math.ceil(cellHeight * pixelRatio));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const glyphUvs = new Float32Array(characters.length * 4);

  canvas.width = atlasCols * atlasCellWidth;
  canvas.height = atlasRows * atlasCellHeight;

  if (!context) return { canvas, glyphUvs };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = `${fontSize * pixelRatio}px ${GLYPH_FONT_FAMILY}`;
  context.textBaseline = "alphabetic";

  for (let index = 0; index < characters.length; index += 1) {
    const glyph = characters[index];
    const col = index % atlasCols;
    const row = Math.floor(index / atlasCols);
    const x = col * atlasCellWidth;
    const y = row * atlasCellHeight;
    const uvIndex = index * 4;

    drawGlyphInCell(context, glyph, x, y, atlasCellWidth, atlasCellHeight, fontSize * pixelRatio);
    glyphUvs[uvIndex] = x / canvas.width;
    glyphUvs[uvIndex + 1] = y / canvas.height;
    glyphUvs[uvIndex + 2] = atlasCellWidth / canvas.width;
    glyphUvs[uvIndex + 3] = atlasCellHeight / canvas.height;
  }

  const atlas = { canvas, glyphUvs };
  setCachedValue(glyphAtlasCache, cacheKey, atlas, MAX_GLYPH_ATLAS_CACHE_SIZE);

  return atlas;
};

export const createWebGlGlyphRenderer = ({
  canvas,
  cellHeight,
  cellWidth,
  characters,
  fontSize,
  gpuNoiseSeed,
  fieldModifierRegions,
}: {
  canvas: HTMLCanvasElement;
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  fontSize: number;
  gpuNoiseSeed?: number;
  fieldModifierRegions: ReadonlyMap<string, GlyphFieldModifierRegion>;
}): GlyphRenderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    stencil: false,
  });
  if (!gl) return null;

  const usesGpuNoise = gpuNoiseSeed !== undefined;
  const { fragmentSource, vertexSource } = createGlyphRasterShaderSources({
    fieldModifierBrightnessBoost: FIELD_MODIFIER_BRIGHTNESS_BOOST,
    fieldModifierBrightnessFloor: FIELD_MODIFIER_BRIGHTNESS_FLOOR,
    fieldModifierBrightnessWhitePoint: FIELD_MODIFIER_BRIGHTNESS_WHITE_POINT,
    fieldModifierSampleSize: FIELD_MODIFIER_SAMPLE_SIZE,
    maxFieldModifierRegions: MAX_FIELD_MODIFIER_REGIONS,
    noiseVisualWhitePoint: NOISE_VISUAL_WHITE_POINT,
    usesGpuNoise,
  });

  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) return null;

  const vertexArray = gl.createVertexArray();
  const cornerBuffer = gl.createBuffer();
  const positionBuffer = gl.createBuffer();
  const brightnessUvBuffer = gl.createBuffer();
  const entropyPositionBuffer = gl.createBuffer();
  const entropyRateBuffer = gl.createBuffer();
  const entropyScaleBuffer = gl.createBuffer();
  const atlasTexture = gl.createTexture();
  const brightnessTexture = gl.createTexture();
  const fieldModifierBrightnessTexture = gl.createTexture();
  const paletteTexture = gl.createTexture();
  const cornerLocation = gl.getAttribLocation(program, "a_corner");
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const brightnessUvLocation = gl.getAttribLocation(program, "a_brightness_uv");
  const entropyPositionLocation = gl.getAttribLocation(program, "a_entropy_position");
  const entropyRateLocation = gl.getAttribLocation(program, "a_entropy_rate");
  const entropyScaleLocation = gl.getAttribLocation(program, "a_entropy_scale");
  const atlasGridLocation = gl.getUniformLocation(program, "u_atlas_grid");
  const brightnessSizeLocation = gl.getUniformLocation(program, "u_brightness_size");
  const canvasSizeLocation = gl.getUniformLocation(program, "u_canvas_size");
  const cellSizeLocation = gl.getUniformLocation(program, "u_cell_size");
  const gridOriginLocation = usesGpuNoise ? gl.getUniformLocation(program, "u_grid_origin") : null;
  const atlasLocation = gl.getUniformLocation(program, "u_atlas");
  const brightnessLocation = gl.getUniformLocation(program, "u_brightness");
  const fieldModifierBrightnessLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_brightness")
    : null;
  const fieldModifierCountLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_count")
    : null;
  const fieldModifierRectsLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_rects[0]")
    : null;
  const fieldModifierBlendsLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_field_modifier_blends[0]")
    : null;
  const paletteLocation = gl.getUniformLocation(program, "u_palette");
  const colorCountLocation = gl.getUniformLocation(program, "u_color_count");
  const entropySeedLocation = gl.getUniformLocation(program, "u_entropy_seed");
  const glyphCountLocation = gl.getUniformLocation(program, "u_glyph_count");
  const noiseSeedLocation = usesGpuNoise ? gl.getUniformLocation(program, "u_noise_seed") : null;
  const visualRangeLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_visual_range")
    : null;
  const sourceTimeLocation = gl.getUniformLocation(program, "u_source_time");
  const entropySampleTimeLocation = usesGpuNoise
    ? gl.getUniformLocation(program, "u_entropy_sample_time")
    : null;
  const glyphFrameRateLocation = gl.getUniformLocation(program, "u_glyph_frame_rate");
  const shaderEntropyLocation = usesGpuNoise
    ? null
    : gl.getUniformLocation(program, "u_shader_entropy");

  if (
    !vertexArray ||
    !cornerBuffer ||
    !positionBuffer ||
    !brightnessUvBuffer ||
    !entropyPositionBuffer ||
    !entropyRateBuffer ||
    !entropyScaleBuffer ||
    !atlasTexture ||
    !brightnessTexture ||
    !fieldModifierBrightnessTexture ||
    !paletteTexture ||
    cornerLocation < 0 ||
    positionLocation < 0 ||
    (!usesGpuNoise && brightnessUvLocation < 0) ||
    entropyPositionLocation < 0 ||
    entropyRateLocation < 0 ||
    entropyScaleLocation < 0 ||
    !atlasGridLocation ||
    (!usesGpuNoise && !brightnessSizeLocation) ||
    !canvasSizeLocation ||
    !cellSizeLocation ||
    !atlasLocation ||
    (!usesGpuNoise && !brightnessLocation) ||
    (usesGpuNoise &&
      (!fieldModifierBrightnessLocation ||
        !fieldModifierCountLocation ||
        !fieldModifierBlendsLocation ||
        !fieldModifierRectsLocation ||
        !gridOriginLocation ||
        !visualRangeLocation)) ||
    !paletteLocation ||
    !colorCountLocation ||
    !entropySeedLocation ||
    !glyphCountLocation ||
    !sourceTimeLocation ||
    !glyphFrameRateLocation ||
    (usesGpuNoise && (!noiseSeedLocation || !entropySampleTimeLocation)) ||
    (!usesGpuNoise && !shaderEntropyLocation)
  ) {
    return null;
  }

  let brightnessUvs = new Float32Array();
  let brightnessBytes = new Uint8Array();
  let lastBrightnessTextureHeight = 0;
  let lastBrightnessTextureWidth = 0;
  let lastEntropyBufferLength = 0;
  let positions = new Float32Array();
  let lastPixelRatio = 0;
  let lastColorsKey = "";
  let lastFieldModifierVersion = -1;
  let lastPositionKey = "";
  const fieldModifierBrightnessBytes = new Uint8Array(
    FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE * MAX_FIELD_MODIFIER_REGIONS,
  );
  const fieldModifierRects = new Float32Array(MAX_FIELD_MODIFIER_REGIONS * 4);
  const fieldModifierBlends = new Float32Array(MAX_FIELD_MODIFIER_REGIONS);
  const atlasCols = Math.ceil(Math.sqrt(characters.length));
  const atlasRows = Math.ceil(characters.length / atlasCols);
  const entropySeed = Math.random() * 100000;

  gl.useProgram(program);
  gl.bindVertexArray(vertexArray);

  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, GLYPH_QUAD_CORNERS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(cornerLocation);
  gl.vertexAttribPointer(cornerLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(positionLocation, 1);

  if (brightnessUvLocation >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, brightnessUvBuffer);
    gl.enableVertexAttribArray(brightnessUvLocation);
    gl.vertexAttribPointer(brightnessUvLocation, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(brightnessUvLocation, 1);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, entropyPositionBuffer);
  gl.enableVertexAttribArray(entropyPositionLocation);
  gl.vertexAttribPointer(entropyPositionLocation, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(entropyPositionLocation, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, entropyRateBuffer);
  gl.enableVertexAttribArray(entropyRateLocation);
  gl.vertexAttribPointer(entropyRateLocation, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(entropyRateLocation, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, entropyScaleBuffer);
  gl.enableVertexAttribArray(entropyScaleLocation);
  gl.vertexAttribPointer(entropyScaleLocation, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(entropyScaleLocation, 1);

  gl.uniform1i(atlasLocation, 0);
  if (brightnessLocation) {
    gl.uniform1i(brightnessLocation, 2);
  }
  if (fieldModifierBrightnessLocation) {
    gl.uniform1i(fieldModifierBrightnessLocation, 3);
  }
  gl.uniform1i(paletteLocation, 1);
  gl.uniform1f(entropySeedLocation, entropySeed);
  gl.uniform1f(glyphCountLocation, characters.length);
  gl.uniform2f(atlasGridLocation, atlasCols, atlasRows);
  gl.uniform2f(cellSizeLocation, cellWidth, cellHeight);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uploadAtlas = (pixelRatio: number): void => {
    const atlas = createGlyphAtlas({ cellHeight, cellWidth, characters, fontSize, pixelRatio });

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  };

  const uploadPalette = (colors: string[]): void => {
    const palette = new Uint8Array(colors.length * 4);

    for (let index = 0; index < colors.length; index += 1) {
      const [red, green, blue, alpha] = parseColor(colors[index]);
      const valueIndex = index * 4;

      palette[valueIndex] = Math.round(red * 255);
      palette[valueIndex + 1] = Math.round(green * 255);
      palette[valueIndex + 2] = Math.round(blue * 255);
      palette[valueIndex + 3] = Math.round(alpha * 255);
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      colors.length,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      palette,
    );
    gl.useProgram(program);
    gl.uniform1i(colorCountLocation, colors.length);
  };

  const uploadBrightness = (brightnessValues: Float32Array, cols: number, rows: number): void => {
    const didResize = cols !== lastBrightnessTextureWidth || rows !== lastBrightnessTextureHeight;

    if (brightnessBytes.length !== brightnessValues.length) {
      brightnessBytes = new Uint8Array(brightnessValues.length);
    }

    for (let index = 0; index < brightnessValues.length; index += 1) {
      brightnessBytes[index] = Math.round(clamp(brightnessValues[index], 0, 1) * 255);
    }

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, brightnessTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (didResize) {
      lastBrightnessTextureWidth = cols;
      lastBrightnessTextureHeight = rows;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        cols,
        rows,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        brightnessBytes,
      );
      return;
    }

    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.UNSIGNED_BYTE, brightnessBytes);
  };

  const uploadFieldModifiers = (fieldModifierRegionsVersion: number): void => {
    if (
      !usesGpuNoise ||
      !fieldModifierCountLocation ||
      !fieldModifierBlendsLocation ||
      !fieldModifierRectsLocation ||
      !fieldModifierBrightnessTexture
    ) {
      return;
    }

    if (lastFieldModifierVersion === fieldModifierRegionsVersion) {
      return;
    }

    lastFieldModifierVersion = fieldModifierRegionsVersion;

    const regions = Array.from(fieldModifierRegions.values())
      .filter((region) => region.width > 0 && region.height > 0 && region.brightnessGrid)
      .slice(0, MAX_FIELD_MODIFIER_REGIONS);

    let regionCount = 0;

    fieldModifierBrightnessBytes.fill(0);
    fieldModifierBlends.fill(0);
    fieldModifierRects.fill(0);

    for (const region of regions) {
      const valueIndex = regionCount * 4;
      const brightnessOffset =
        regionCount * FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;

      fieldModifierRects[valueIndex] = region.documentLeft;
      fieldModifierRects[valueIndex + 1] = region.documentTop;
      fieldModifierRects[valueIndex + 2] = region.width;
      fieldModifierRects[valueIndex + 3] = region.height;
      fieldModifierBlends[regionCount] = region.blend;
      fieldModifierBrightnessBytes.set(region.brightnessGrid ?? [], brightnessOffset);
      regionCount += 1;
    }

    gl.useProgram(program);
    gl.uniform1i(fieldModifierCountLocation, regionCount);
    gl.uniform1fv(fieldModifierBlendsLocation, fieldModifierBlends);
    gl.uniform4fv(fieldModifierRectsLocation, fieldModifierRects);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, fieldModifierBrightnessTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      FIELD_MODIFIER_SAMPLE_SIZE,
      FIELD_MODIFIER_SAMPLE_SIZE * MAX_FIELD_MODIFIER_REGIONS,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      fieldModifierBrightnessBytes,
    );
  };

  const uploadEntropyPositions = (entropyValues: Float32Array, usage: number): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, entropyPositionBuffer);

    if (entropyValues.length !== lastEntropyBufferLength) {
      lastEntropyBufferLength = entropyValues.length;
      gl.bufferData(gl.ARRAY_BUFFER, entropyValues, usage);
      return;
    }

    gl.bufferSubData(gl.ARRAY_BUFFER, 0, entropyValues);
  };

  const uploadEntropyRates = (entropyRates: Float32Array): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, entropyRateBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, entropyRates, gl.DYNAMIC_DRAW);
  };

  const uploadEntropyScales = (entropyScales: Float32Array): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, entropyScaleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, entropyScales, gl.STATIC_DRAW);
  };

  return {
    draw: ({
      backgroundColor,
      brightnessValues,
      cellHeight,
      cellWidth,
      colors,
      cols,
      entropySampleTime,
      gpuNoiseSeed: stateGpuNoiseSeed,
      offsetX,
      offsetY,
      glyphEntropyPositions,
      glyphEntropyRates,
      glyphEntropyScales,
      glyphFrameRate,
      rows,
      entropyMode,
      fieldModifierRegionsVersion,
      shouldUpdateBrightness,
      shouldUploadEntropy,
      sourceTime,
      gridOriginX,
      gridOriginY,
      visualRange,
    }: GlyphRenderState): void => {
      const cellCount = cols * rows;
      const didResize = positions.length !== cellCount * 2;

      if (didResize) {
        brightnessUvs = new Float32Array(cellCount * 2);
        positions = new Float32Array(cellCount * 2);
        lastPositionKey = "";
      }

      const colorsKey = colors.join("|");
      if (colorsKey !== lastColorsKey) {
        lastColorsKey = colorsKey;
        uploadPalette(colors);
      }

      const positionKey = [cols, rows, offsetX, offsetY, cellWidth, cellHeight].join(":");
      const shouldUploadPositions = positionKey !== lastPositionKey;
      const shouldUploadBrightness = didResize || shouldUpdateBrightness;
      if (shouldUploadPositions) {
        lastPositionKey = positionKey;
      }

      if (shouldUploadPositions) {
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const index = row * cols + col;
            const positionIndex = index * 2;

            brightnessUvs[positionIndex] = (col + 0.5) / cols;
            brightnessUvs[positionIndex + 1] = (row + 0.5) / rows;
            positions[positionIndex] = offsetX + col * cellWidth;
            positions[positionIndex + 1] = offsetY + row * cellHeight;
          }
        }
      }

      const [red, green, blue, alpha] = parseColor(backgroundColor);
      gl.clearColor(red, green, blue, alpha);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vertexArray);
      gl.uniform2f(brightnessSizeLocation, cols, rows);
      gl.uniform2f(cellSizeLocation, cellWidth, cellHeight);

      if (
        usesGpuNoise &&
        noiseSeedLocation &&
        sourceTimeLocation &&
        entropySampleTimeLocation &&
        glyphFrameRateLocation &&
        visualRangeLocation
      ) {
        gl.uniform1f(noiseSeedLocation, stateGpuNoiseSeed ?? 0);
        gl.uniform1f(sourceTimeLocation, sourceTime);
        gl.uniform1f(entropySampleTimeLocation, entropySampleTime);
        gl.uniform1f(glyphFrameRateLocation, glyphFrameRate);
        gl.uniform1f(visualRangeLocation, visualRange);
        gl.uniform2f(gridOriginLocation, gridOriginX, gridOriginY);
        uploadFieldModifiers(fieldModifierRegionsVersion);
      } else if (
        !usesGpuNoise &&
        sourceTimeLocation &&
        glyphFrameRateLocation &&
        shaderEntropyLocation
      ) {
        gl.uniform1f(sourceTimeLocation, sourceTime);
        gl.uniform1f(glyphFrameRateLocation, glyphFrameRate);
        gl.uniform1f(shaderEntropyLocation, entropyMode === "shader" ? 1 : 0);
      }

      if (shouldUploadPositions || shouldUploadEntropy) {
        uploadEntropyScales(glyphEntropyScales);
      }

      if (shouldUploadPositions || shouldUpdateBrightness || shouldUploadEntropy) {
        uploadEntropyRates(glyphEntropyRates);
      }

      if (usesGpuNoise) {
        if (shouldUpdateBrightness || shouldUploadEntropy) {
          uploadEntropyPositions(glyphEntropyPositions, gl.DYNAMIC_DRAW);
        }
      } else if (shouldUploadPositions || entropyMode === "cpu") {
        uploadEntropyPositions(glyphEntropyPositions, gl.DYNAMIC_DRAW);
      }

      if (shouldUploadPositions) {
        gl.bindBuffer(gl.ARRAY_BUFFER, brightnessUvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, brightnessUvs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      }

      if (!usesGpuNoise && shouldUploadBrightness) {
        uploadBrightness(brightnessValues, cols, rows);
      }

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cellCount);
    },
    resize: ({ cssHeight, cssWidth, pixelRatio }: GlyphRenderSize): void => {
      canvas.width = cssWidth * pixelRatio;
      canvas.height = cssHeight * pixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform2f(canvasSizeLocation, cssWidth, cssHeight);

      if (pixelRatio !== lastPixelRatio) {
        lastPixelRatio = pixelRatio;
        uploadAtlas(pixelRatio);
      }
    },
    supportsShaderEntropy: true,
    usesGpuGlyphSelection: true,
  };
};
