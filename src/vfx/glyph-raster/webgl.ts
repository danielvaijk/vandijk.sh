import { createGlyphRasterShaderSources } from "src/vfx/glyph-raster/shaders";
import {
  FIELD_MODIFIER_SAMPLE_SIZE,
  GLYPH_CELL_PADDING_RATIO,
  GLYPH_FONT_FAMILY,
  GLYPH_RASTER_SHADER_OPTIONS,
  MAX_FIELD_MODIFIER_REGIONS,
} from "src/vfx/glyph-raster/config";

interface GlyphRenderSize {
  cellHeight: number;
  cellWidth: number;
  cssHeight: number;
  cssWidth: number;
  fontSize: number;
  pixelRatio: number;
}

interface GlyphFieldModifierRegion {
  blend: number;
  brightnessGrid?: Uint8Array;
  documentLeft: number;
  documentTop: number;
  height: number;
  width: number;
}

interface GlyphRenderState {
  backgroundColor: string;
  cellHeight: number;
  cellWidth: number;
  colors: string[];
  cols: number;
  glyphFrameRate: number;
  offsetX: number;
  offsetY: number;
  rows: number;
  fieldModifierRegionsVersion: number;
  sourceTime: number;
  gridOriginX: number;
  gridOriginY: number;
  visualRange: number;
}

interface GlyphRenderer {
  draw: (state: GlyphRenderState) => void;
  resize: (size: GlyphRenderSize) => void;
}

const MAX_GLYPH_ATLAS_CACHE_SIZE = 8;
const MAX_GLYPH_DRAW_METRICS_CACHE_SIZE = 512;
const MAX_PARSED_COLOR_CACHE_SIZE = 32;
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

function getCachedValue<Value>(cache: Map<string, Value>, key: string): Value | null {
  const value = cache.get(key);
  if (typeof value === "undefined") {
    return null;
  }

  cache.delete(key);
  cache.set(key, value);

  return value;
}

function setCachedValue<Value>({
  cache,
  key,
  value,
  maxSize,
}: {
  cache: Map<string, Value>;
  key: string;
  value: Value;
  maxSize: number;
}): void {
  cache.delete(key);
  cache.set(key, value);

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      return;
    }

    cache.delete(oldestKey);
  }
}
function parseColor(color: string): [number, number, number, number] {
  const cachedColor = getCachedValue(parsedColorCache, color);
  if (cachedColor) {
    return cachedColor;
  }

  let parsedColor: [number, number, number, number] = [0, 0, 0, 1];

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

  setCachedValue({
    cache: parsedColorCache,
    key: color,
    maxSize: MAX_PARSED_COLOR_CACHE_SIZE,
    value: parsedColor,
  });

  return parsedColor;
}

function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  type: number,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!vertexShader || !fragmentShader || !program) {
    return null;
  }

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
}

function getGlyphDrawMetrics(
  context: CanvasRenderingContext2D,
  glyph: string,
  cellWidth: number,
  cellHeight: number,
  fontSize: number,
): {
  offsetX: number;
  offsetY: number;
  scale: number;
} {
  const cacheKey = [glyph, cellWidth, cellHeight, fontSize].join(":");
  const cachedMetrics = getCachedValue(glyphDrawMetricsCache, cacheKey);
  if (cachedMetrics) {
    return cachedMetrics;
  }

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

  setCachedValue({
    cache: glyphDrawMetricsCache,
    key: cacheKey,
    maxSize: MAX_GLYPH_DRAW_METRICS_CACHE_SIZE,
    value: resolvedMetrics,
  });

  return resolvedMetrics;
}

function drawGlyphInCell(
  context: CanvasRenderingContext2D,
  glyph: string,
  positionX: number,
  positionY: number,
  cellWidth: number,
  cellHeight: number,
  fontSize: number,
): void {
  const metrics = getGlyphDrawMetrics(context, glyph, cellWidth, cellHeight, fontSize);

  context.save();
  context.translate(positionX + metrics.offsetX, positionY + metrics.offsetY);
  context.scale(metrics.scale, metrics.scale);
  context.fillText(glyph, 0, 0);
  context.restore();
}

function createGlyphAtlas({
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
} {
  const cacheKey = [cellHeight, cellWidth, characters.join(""), fontSize, pixelRatio].join(":");
  const cachedAtlas = getCachedValue(glyphAtlasCache, cacheKey);
  if (cachedAtlas) {
    return cachedAtlas;
  }

  const atlasCols = Math.ceil(Math.sqrt(characters.length));
  const atlasRows = Math.ceil(characters.length / atlasCols);
  const atlasCellWidth = Math.max(1, Math.ceil(cellWidth * pixelRatio));
  const atlasCellHeight = Math.max(1, Math.ceil(cellHeight * pixelRatio));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const glyphUvs = new Float32Array(characters.length * 4);

  canvas.width = atlasCols * atlasCellWidth;
  canvas.height = atlasRows * atlasCellHeight;

  if (!context) {
    return { canvas, glyphUvs };
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = `${fontSize * pixelRatio}px ${GLYPH_FONT_FAMILY}`;
  context.textBaseline = "alphabetic";

  for (let index = 0; index < characters.length; index += 1) {
    const glyph = characters[index];
    const col = index % atlasCols;
    const row = Math.floor(index / atlasCols);
    const cellX = col * atlasCellWidth;
    const cellY = row * atlasCellHeight;
    const uvIndex = index * 4;

    drawGlyphInCell(
      context,
      glyph,
      cellX,
      cellY,
      atlasCellWidth,
      atlasCellHeight,
      fontSize * pixelRatio,
    );
    glyphUvs[uvIndex] = cellX / canvas.width;
    glyphUvs[uvIndex + 1] = cellY / canvas.height;
    glyphUvs[uvIndex + 2] = atlasCellWidth / canvas.width;
    glyphUvs[uvIndex + 3] = atlasCellHeight / canvas.height;
  }

  const atlas = { canvas, glyphUvs };
  setCachedValue({
    cache: glyphAtlasCache,
    key: cacheKey,
    maxSize: MAX_GLYPH_ATLAS_CACHE_SIZE,
    value: atlas,
  });

  return atlas;
}

function createWebGlGlyphRenderer({
  canvas,
  cellHeight,
  cellWidth,
  characters,
  entropySeed,
  fontSize,
  gpuNoiseSeed,
  fieldModifierRegions,
}: {
  canvas: HTMLCanvasElement;
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  entropySeed: number;
  fontSize: number;
  gpuNoiseSeed: number;
  fieldModifierRegions: ReadonlyMap<string, GlyphFieldModifierRegion>;
}): GlyphRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    stencil: false,
  });
  if (!gl) {
    return null;
  }

  const { fragmentSource, vertexSource } = createGlyphRasterShaderSources(
    GLYPH_RASTER_SHADER_OPTIONS,
  );

  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) {
    return null;
  }

  const vertexArray = gl.createVertexArray();
  const cornerBuffer = gl.createBuffer();
  const positionBuffer = gl.createBuffer();
  const atlasTexture = gl.createTexture();
  const fieldModifierBrightnessTexture = gl.createTexture();
  const paletteTexture = gl.createTexture();
  const cornerLocation = gl.getAttribLocation(program, "a_corner");
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const atlasGridLocation = gl.getUniformLocation(program, "u_atlas_grid");
  const canvasSizeLocation = gl.getUniformLocation(program, "u_canvas_size");
  const cellSizeLocation = gl.getUniformLocation(program, "u_cell_size");
  const gridOriginLocation = gl.getUniformLocation(program, "u_grid_origin");
  const atlasLocation = gl.getUniformLocation(program, "u_atlas");
  const fieldModifierBrightnessLocation = gl.getUniformLocation(
    program,
    "u_field_modifier_brightness",
  );
  const fieldModifierCountLocation = gl.getUniformLocation(program, "u_field_modifier_count");
  const fieldModifierRectsLocation = gl.getUniformLocation(program, "u_field_modifier_rects[0]");
  const fieldModifierBlendsLocation = gl.getUniformLocation(program, "u_field_modifier_blends[0]");
  const paletteLocation = gl.getUniformLocation(program, "u_palette");
  const colorCountLocation = gl.getUniformLocation(program, "u_color_count");
  const entropySeedLocation = gl.getUniformLocation(program, "u_entropy_seed");
  const glyphCountLocation = gl.getUniformLocation(program, "u_glyph_count");
  const noiseSeedLocation = gl.getUniformLocation(program, "u_noise_seed");
  const visualRangeLocation = gl.getUniformLocation(program, "u_visual_range");
  const sourceTimeLocation = gl.getUniformLocation(program, "u_source_time");
  const glyphFrameRateLocation = gl.getUniformLocation(program, "u_glyph_frame_rate");

  if (
    !vertexArray ||
    !cornerBuffer ||
    !positionBuffer ||
    !atlasTexture ||
    !fieldModifierBrightnessTexture ||
    !paletteTexture ||
    cornerLocation < 0 ||
    positionLocation < 0 ||
    !atlasGridLocation ||
    !canvasSizeLocation ||
    !cellSizeLocation ||
    !atlasLocation ||
    !fieldModifierBrightnessLocation ||
    !fieldModifierCountLocation ||
    !fieldModifierBlendsLocation ||
    !fieldModifierRectsLocation ||
    !gridOriginLocation ||
    !visualRangeLocation ||
    !paletteLocation ||
    !colorCountLocation ||
    !entropySeedLocation ||
    !glyphCountLocation ||
    !sourceTimeLocation ||
    !glyphFrameRateLocation ||
    !noiseSeedLocation
  ) {
    return null;
  }

  let positions = new Float32Array();
  let atlasCellHeight = cellHeight;
  let atlasCellWidth = cellWidth;
  let atlasFontSize = fontSize;
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

  gl.uniform1i(atlasLocation, 0);
  gl.uniform1i(fieldModifierBrightnessLocation, 3);
  gl.uniform1i(paletteLocation, 1);
  gl.uniform1f(entropySeedLocation, entropySeed);
  gl.uniform1f(glyphCountLocation, characters.length);
  gl.uniform2f(atlasGridLocation, atlasCols, atlasRows);
  gl.uniform2f(cellSizeLocation, cellWidth, cellHeight);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uploadAtlas = (pixelRatio: number): void => {
    const atlas = createGlyphAtlas({
      cellHeight: atlasCellHeight,
      cellWidth: atlasCellWidth,
      characters,
      fontSize: atlasFontSize,
      pixelRatio,
    });

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

  const uploadFieldModifiers = (fieldModifierRegionsVersion: number): void => {
    if (
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

    const regions = [...fieldModifierRegions.values()]
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

  return {
    draw: ({
      backgroundColor,
      cellHeight,
      cellWidth,
      colors,
      cols,
      offsetX,
      offsetY,
      glyphFrameRate,
      rows,
      fieldModifierRegionsVersion,
      sourceTime,
      gridOriginX,
      gridOriginY,
      visualRange,
    }: GlyphRenderState): void => {
      const cellCount = cols * rows;
      const didResize = positions.length !== cellCount * 2;

      if (didResize) {
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
      if (shouldUploadPositions) {
        lastPositionKey = positionKey;
      }

      if (shouldUploadPositions) {
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const index = row * cols + col;
            const positionIndex = index * 2;

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
      gl.uniform2f(cellSizeLocation, cellWidth, cellHeight);
      gl.uniform1f(noiseSeedLocation, gpuNoiseSeed);
      gl.uniform1f(sourceTimeLocation, sourceTime);
      gl.uniform1f(glyphFrameRateLocation, glyphFrameRate);
      gl.uniform1f(visualRangeLocation, visualRange);
      gl.uniform2f(gridOriginLocation, gridOriginX, gridOriginY);
      uploadFieldModifiers(fieldModifierRegionsVersion);

      if (shouldUploadPositions) {
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      }

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cellCount);
    },
    resize: ({
      cellHeight: nextCellHeight,
      cellWidth: nextCellWidth,
      cssHeight,
      cssWidth,
      fontSize: nextFontSize,
      pixelRatio,
    }: GlyphRenderSize): void => {
      const didUpdateAtlasMetrics =
        nextCellHeight !== atlasCellHeight ||
        nextCellWidth !== atlasCellWidth ||
        nextFontSize !== atlasFontSize;
      atlasCellHeight = nextCellHeight;
      atlasCellWidth = nextCellWidth;
      atlasFontSize = nextFontSize;
      canvas.width = cssWidth * pixelRatio;
      canvas.height = cssHeight * pixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform2f(canvasSizeLocation, cssWidth, cssHeight);

      if (didUpdateAtlasMetrics || pixelRatio !== lastPixelRatio) {
        lastPixelRatio = pixelRatio;
        uploadAtlas(pixelRatio);
      }
    },
  };
}

export { createWebGlGlyphRenderer };
export type { GlyphFieldModifierRegion, GlyphRenderSize, GlyphRenderState, GlyphRenderer };
