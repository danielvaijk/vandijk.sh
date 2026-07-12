import {
  FIELD_MODIFIER_SAMPLE_SIZE,
  GLYPH_CELL_PADDING_RATIO,
  GLYPH_FONT_FAMILY,
  GLYPH_RASTER_SHADER_OPTIONS,
  MAX_FIELD_MODIFIER_REGIONS,
} from "src/vfx/glyph-raster/config";
import { createGlyphRasterShaderSources } from "src/vfx/glyph-raster/shaders";

interface InitialGlyphFrameOptions {
  backgroundColor: string;
  canvasId: string;
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  colors: string[];
  entropySeed: number;
  fieldModifierSampleSize: number;
  fontFamily: string;
  fontSize: number;
  fragmentSource: string;
  frameRate: number;
  gpuNoiseSeed: number;
  glyphCellPaddingRatio: number;
  maxFieldModifierRegions: number;
  maxGridCells: number;
  vertexSource: string;
  visualRange: number;
}

interface InitialFrameCanvas extends HTMLCanvasElement {
  __disposeGlyphInitialFrame?: () => void;
}

function drawInitialGlyphFrame(options: InitialGlyphFrameOptions): void {
  try {
    const canvas = document.getElementById(options.canvasId) as InitialFrameCanvas | null;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      stencil: false,
    });
    if (!gl) {
      return;
    }

    const compileShader = (source: string, type: number): WebGLShader | null => {
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
    };
    const vertexShader = compileShader(options.vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(options.fragmentSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) {
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const resolveCssLength = (name: string, fallback: number): number => {
      const root = document.documentElement;
      const value = getComputedStyle(root).getPropertyValue(name).trim();
      if (!value) {
        return fallback;
      }

      const probe = document.createElement("div");
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.width = value;
      root.append(probe);
      const resolved = probe.getBoundingClientRect().width;
      probe.remove();

      return Number.isFinite(resolved) && resolved > 0 ? resolved : fallback;
    };
    const baseCellWidth = resolveCssLength("--glyph-cell-width", options.cellWidth);
    const baseCellHeight = resolveCssLength("--glyph-cell-height", options.cellHeight);
    const fontSize = resolveCssLength("--glyph-font-size", options.fontSize);
    const cssWidth = canvas.clientWidth || window.innerWidth;
    const cssHeight = canvas.clientHeight || window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = cssWidth * pixelRatio;
    canvas.height = cssHeight * pixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const baseColumns = Math.max(1, Math.ceil(cssWidth / baseCellWidth));
    const baseRows = Math.max(1, Math.ceil(cssHeight / baseCellHeight));
    const cellScale = Math.min(
      8,
      Math.max(1, Math.sqrt((baseColumns * baseRows) / options.maxGridCells)),
    );
    const cellWidth = baseCellWidth * cellScale;
    const cellHeight = baseCellHeight * cellScale;
    const columns = Math.max(1, Math.ceil(cssWidth / cellWidth)) + 1;
    const rows = Math.max(1, Math.ceil(cssHeight / cellHeight)) + 1;
    const cellCount = columns * rows;
    const positions = new Float32Array(cellCount * 2);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const positionIndex = (row * columns + column) * 2;
        positions[positionIndex] = column * cellWidth;
        positions[positionIndex + 1] = row * cellHeight;
      }
    }

    const atlasColumns = Math.ceil(Math.sqrt(options.characters.length));
    const atlasRows = Math.ceil(options.characters.length / atlasColumns);
    const atlasCellWidth = Math.max(1, Math.ceil(baseCellWidth * pixelRatio));
    const atlasCellHeight = Math.max(1, Math.ceil(baseCellHeight * pixelRatio));
    const atlas = document.createElement("canvas");
    const atlasContext = atlas.getContext("2d");
    atlas.width = atlasColumns * atlasCellWidth;
    atlas.height = atlasRows * atlasCellHeight;
    if (!atlasContext) {
      return;
    }

    atlasContext.clearRect(0, 0, atlas.width, atlas.height);
    atlasContext.fillStyle = "#ffffff";
    atlasContext.font = `${fontSize * pixelRatio}px ${options.fontFamily}`;
    atlasContext.textBaseline = "alphabetic";

    for (let index = 0; index < options.characters.length; index += 1) {
      const glyph = options.characters[index];
      const metrics = atlasContext.measureText(glyph);
      const left = metrics.actualBoundingBoxLeft || 0;
      const right = metrics.actualBoundingBoxRight || metrics.width;
      const ascent = metrics.actualBoundingBoxAscent || fontSize * pixelRatio;
      const descent = metrics.actualBoundingBoxDescent || 0;
      const glyphWidth = Math.max(1, left + right);
      const glyphHeight = Math.max(1, ascent + descent);
      const paddingX = Math.max(0.5, atlasCellWidth * options.glyphCellPaddingRatio);
      const paddingY = Math.max(0.5, atlasCellHeight * options.glyphCellPaddingRatio);
      const scale = Math.min(
        1,
        Math.max(1, atlasCellWidth - paddingX * 2) / glyphWidth,
        Math.max(1, atlasCellHeight - paddingY * 2) / glyphHeight,
      );
      const cellX = (index % atlasColumns) * atlasCellWidth;
      const cellY = Math.floor(index / atlasColumns) * atlasCellHeight;
      const offsetX = (atlasCellWidth - glyphWidth * scale) / 2 + left * scale;
      const offsetY = (atlasCellHeight - glyphHeight * scale) / 2 + ascent * scale;

      atlasContext.save();
      atlasContext.translate(cellX + offsetX, cellY + offsetY);
      atlasContext.scale(scale, scale);
      atlasContext.fillText(glyph, 0, 0);
      atlasContext.restore();
    }

    const vertexArray = gl.createVertexArray();
    const cornerBuffer = gl.createBuffer();
    const positionBuffer = gl.createBuffer();
    const atlasTexture = gl.createTexture();
    const paletteTexture = gl.createTexture();
    const fieldModifierTexture = gl.createTexture();
    if (
      !vertexArray ||
      !cornerBuffer ||
      !positionBuffer ||
      !atlasTexture ||
      !paletteTexture ||
      !fieldModifierTexture
    ) {
      return;
    }

    const cornerLocation = gl.getAttribLocation(program, "a_corner");
    const positionLocation = gl.getAttribLocation(program, "a_position");
    if (cornerLocation < 0 || positionLocation < 0) {
      return;
    }

    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(cornerLocation);
    gl.vertexAttribPointer(cornerLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(positionLocation, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);

    const palette = new Uint8Array(options.colors.length * 4);
    for (let index = 0; index < options.colors.length; index += 1) {
      const color = options.colors[index];
      const valueIndex = index * 4;
      palette[valueIndex] = Number.parseInt(color.slice(1, 3), 16);
      palette[valueIndex + 1] = Number.parseInt(color.slice(3, 5), 16);
      palette[valueIndex + 2] = Number.parseInt(color.slice(5, 7), 16);
      palette[valueIndex + 3] = 255;
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
      options.colors.length,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      palette,
    );

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, fieldModifierTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      options.fieldModifierSampleSize,
      options.fieldModifierSampleSize * options.maxFieldModifierRegions,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null,
    );

    const uniform1f = (name: string, value: number): void => {
      const location = gl.getUniformLocation(program, name);
      if (location) {
        gl.uniform1f(location, value);
      }
    };
    const uniform1i = (name: string, value: number): void => {
      const location = gl.getUniformLocation(program, name);
      if (location) {
        gl.uniform1i(location, value);
      }
    };
    const uniform2f = (name: string, first: number, second: number): void => {
      const location = gl.getUniformLocation(program, name);
      if (location) {
        gl.uniform2f(location, first, second);
      }
    };

    uniform1i("u_atlas", 0);
    uniform1i("u_palette", 1);
    uniform1i("u_field_modifier_brightness", 3);
    uniform1i("u_field_modifier_count", 0);
    uniform1i("u_color_count", options.colors.length);
    uniform1f("u_entropy_seed", options.entropySeed);
    uniform1f("u_glyph_count", options.characters.length);
    uniform1f("u_noise_seed", options.gpuNoiseSeed);
    uniform1f("u_source_time", 0);
    uniform1f("u_glyph_frame_rate", options.frameRate);
    uniform1f("u_visual_range", options.visualRange);
    uniform2f("u_atlas_grid", atlasColumns, atlasRows);
    uniform2f("u_canvas_size", cssWidth, cssHeight);
    uniform2f("u_cell_size", cellWidth, cellHeight);
    uniform2f("u_grid_origin", 0, 0);

    const red = Number.parseInt(options.backgroundColor.slice(1, 3), 16) / 255;
    const green = Number.parseInt(options.backgroundColor.slice(3, 5), 16) / 255;
    const blue = Number.parseInt(options.backgroundColor.slice(5, 7), 16) / 255;
    gl.clearColor(red, green, blue, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cellCount);
    canvas.dataset.glyphInitialFrame = "";
    canvas.__disposeGlyphInitialFrame = (): void => {
      gl.deleteBuffer(cornerBuffer);
      gl.deleteBuffer(positionBuffer);
      gl.deleteTexture(atlasTexture);
      gl.deleteTexture(paletteTexture);
      gl.deleteTexture(fieldModifierTexture);
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(program);
      delete canvas.__disposeGlyphInitialFrame;
      delete canvas.dataset.glyphInitialFrame;
    };
  } catch {
    /* The canvas background remains the no-WebGL first-paint fallback. */
  }
}

function createInitialGlyphFrameScript(
  options: Omit<
    InitialGlyphFrameOptions,
    | "fieldModifierSampleSize"
    | "fontFamily"
    | "fragmentSource"
    | "glyphCellPaddingRatio"
    | "maxFieldModifierRegions"
    | "vertexSource"
  >,
): string {
  const { fragmentSource, vertexSource } = createGlyphRasterShaderSources(
    GLYPH_RASTER_SHADER_OPTIONS,
  );
  const serializedOptions = JSON.stringify({
    ...options,
    fieldModifierSampleSize: FIELD_MODIFIER_SAMPLE_SIZE,
    glyphCellPaddingRatio: GLYPH_CELL_PADDING_RATIO,
    fontFamily: GLYPH_FONT_FAMILY,
    fragmentSource,
    maxFieldModifierRegions: MAX_FIELD_MODIFIER_REGIONS,
    vertexSource,
  }).replaceAll("<", "\\u003c");

  return `(${drawInitialGlyphFrame.toString()})(${serializedOptions});`;
}

export { createInitialGlyphFrameScript };
