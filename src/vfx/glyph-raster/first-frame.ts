import {
  FIELD_MODIFIER_SAMPLE_SIZE,
  GLYPH_CELL_PADDING_RATIO,
  GLYPH_FONT_FAMILY,
  GLYPH_RASTER_SHADER_OPTIONS,
  MAX_FIELD_MODIFIER_REGIONS,
  PROCEDURAL_LAYOUT_SAMPLE_RATE,
} from "src/vfx/glyph-raster/config";
import { DOCUMENT_ANCHOR_EDGE_MARGIN, DOCUMENT_ANCHOR_OVERSCAN } from "src/vfx/glyph-raster/logic";
import { createGlyphRasterShaderSources } from "src/vfx/glyph-raster/shaders";

interface InitialGlyphFrameOptions {
  backgroundColor: string;
  canvasId: string;
  cellHeight: number;
  cellWidth: number;
  characters: string[];
  colors: string[];
  documentAnchor: boolean;
  documentAnchorEdgeMargin: number;
  documentAnchorOverscan: number;
  entropySeed: number;
  fieldModifierSampleSize: number;
  fontFamily: string;
  fontSize: number;
  fragmentSource: string;
  frameRate: number;
  gpuNoiseSeed: number;
  glyphCellPaddingRatio: number;
  layoutSampleRate: number;
  maxFieldModifierRegions: number;
  maxGridCells: number;
  modifierPosters: Record<string, InitialGlyphModifierPoster>;
  vertexSource: string;
  visualRange: number;
}

interface InitialFrameCanvas extends HTMLCanvasElement {
  __disposeGlyphInitialFrame?: () => void;
}

interface InitialGlyphModifierOptions {
  blend: number;
  elementId: string;
  sourceUrl: string;
}

interface InitialGlyphModifierPoster {
  cols: number;
  data: string;
  rows: number;
}

interface InitialGlyphModifier {
  baseBlend: number;
  blend: number;
  brightnessGrid: Uint8Array;
  documentLeft: number;
  documentTop: number;
  elementId: string;
  height: number;
  width: number;
}

interface InitialGlyphFrameState {
  disposed: boolean;
  modifiers: InitialGlyphModifier[];
  posters: Record<string, InitialGlyphModifierPoster>;
  registerModifier: (modifier: InitialGlyphModifierOptions) => void;
}

interface InitialGlyphFrameGlobal {
  __glyphInitialFrame?: InitialGlyphFrameState;
  __glyphInitialFrameQueue?: InitialGlyphModifierOptions[];
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
    const readLargeViewportHeight = (): number => {
      const probe = document.createElement("div");
      probe.style.position = "fixed";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.height = "100lvh";
      document.documentElement.append(probe);

      const { height } = probe.getBoundingClientRect();
      probe.remove();

      return height > 0 ? height : window.innerHeight;
    };
    let baseCellWidth = resolveCssLength("--glyph-cell-width", options.cellWidth);
    let baseCellHeight = resolveCssLength("--glyph-cell-height", options.cellHeight);
    let fontSize = resolveCssLength("--glyph-font-size", options.fontSize);
    let largeViewportHeight = readLargeViewportHeight();
    let documentHeight = Math.max(document.body.offsetHeight, largeViewportHeight);
    let canvasTop = 0;
    if (options.documentAnchor) {
      // Match the runtime's document-space canvas before the first paint so
      // The compositor scrolls the frozen field with the page.
      canvas.style.position = "absolute";
      canvas.style.top = "0px";
      canvas.style.height = `${Math.min(
        Math.round(largeViewportHeight * options.documentAnchorOverscan),
        Math.floor(documentHeight),
      )}px`;
    }

    const resolveGrid = (
      width: number,
      height: number,
    ): {
      cellCount: number;
      cellHeight: number;
      cellWidth: number;
      positions: Float32Array;
    } => {
      const baseColumns = Math.max(1, Math.ceil(width / baseCellWidth));
      const baseRows = Math.max(1, Math.ceil(height / baseCellHeight));
      const maxGridCells =
        options.maxGridCells *
        // Preserve the viewport-density cell scale as the streamed document
        // Grows the initial canvas toward its overscan height.
        (options.documentAnchor ? Math.max(1, height / largeViewportHeight) : 1);
      const cellScale = Math.min(
        8,
        Math.max(1, Math.sqrt((baseColumns * baseRows) / maxGridCells)),
      );
      const cellWidth = baseCellWidth * cellScale;
      const cellHeight = baseCellHeight * cellScale;
      const columns = Math.max(1, Math.ceil(width / cellWidth)) + 1;
      const rows = Math.max(1, Math.ceil(height / cellHeight)) + 1;
      const cellCount = columns * rows;
      const positions = new Float32Array(cellCount * 2);

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const positionIndex = (row * columns + column) * 2;
          positions[positionIndex] = column * cellWidth;
          positions[positionIndex + 1] = row * cellHeight;
        }
      }

      return { cellCount, cellHeight, cellWidth, positions };
    };
    let cssWidth = canvas.clientWidth || window.innerWidth;
    let cssHeight = canvas.clientHeight || largeViewportHeight;
    let pixelRatio = window.devicePixelRatio || 1;
    canvas.width = cssWidth * pixelRatio;
    canvas.height = cssHeight * pixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const initialGrid = resolveGrid(cssWidth, cssHeight);
    let { cellCount, cellHeight, cellWidth, positions } = initialGrid;

    const atlasColumns = Math.ceil(Math.sqrt(options.characters.length));
    const atlasRows = Math.ceil(options.characters.length / atlasColumns);
    const atlas = document.createElement("canvas");
    const atlasContext = atlas.getContext("2d");
    if (!atlasContext) {
      return;
    }
    const drawGlyphAtlas = (): void => {
      const atlasCellWidth = Math.max(1, Math.ceil(baseCellWidth * pixelRatio));
      const atlasCellHeight = Math.max(1, Math.ceil(baseCellHeight * pixelRatio));
      atlas.width = atlasColumns * atlasCellWidth;
      atlas.height = atlasRows * atlasCellHeight;
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
    };
    drawGlyphAtlas();

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
    const uploadGlyphAtlas = (): void => {
      drawGlyphAtlas();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    };

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
    const refreshViewportMetrics = (): boolean => {
      const nextBaseCellWidth = resolveCssLength("--glyph-cell-width", options.cellWidth);
      const nextBaseCellHeight = resolveCssLength("--glyph-cell-height", options.cellHeight);
      const nextFontSize = resolveCssLength("--glyph-font-size", options.fontSize);
      const nextLargeViewportHeight = readLargeViewportHeight();
      const nextPixelRatio = window.devicePixelRatio || 1;
      const didAtlasChange =
        nextBaseCellWidth !== baseCellWidth ||
        nextBaseCellHeight !== baseCellHeight ||
        nextFontSize !== fontSize ||
        nextPixelRatio !== pixelRatio;
      const didChange = didAtlasChange || nextLargeViewportHeight !== largeViewportHeight;

      baseCellWidth = nextBaseCellWidth;
      baseCellHeight = nextBaseCellHeight;
      fontSize = nextFontSize;
      largeViewportHeight = nextLargeViewportHeight;
      pixelRatio = nextPixelRatio;
      if (didAtlasChange) {
        uploadGlyphAtlas();
      }

      return didChange;
    };
    const resizeGrid = (force = false): boolean => {
      const nextCssWidth = canvas.clientWidth || window.innerWidth;
      const nextCssHeight = canvas.clientHeight || largeViewportHeight;
      if (!force && nextCssWidth === cssWidth && nextCssHeight === cssHeight) {
        return false;
      }

      cssWidth = nextCssWidth;
      cssHeight = nextCssHeight;
      canvas.width = cssWidth * pixelRatio;
      canvas.height = cssHeight * pixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);

      const nextGrid = resolveGrid(cssWidth, cssHeight);
      ({ cellCount, cellHeight, cellWidth, positions } = nextGrid);
      gl.useProgram(program);
      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      uniform2f("u_canvas_size", cssWidth, cssHeight);
      uniform2f("u_cell_size", cellWidth, cellHeight);

      return true;
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
    const modifierBrightness = new Uint8Array(
      options.fieldModifierSampleSize ** 2 * options.maxFieldModifierRegions,
    );
    const modifierBlends = new Float32Array(options.maxFieldModifierRegions);
    const modifierRects = new Float32Array(options.maxFieldModifierRegions * 4);
    const initialFrameGlobal = globalThis as typeof globalThis & InitialGlyphFrameGlobal;
    const activeModifierBlendTransitions = new Set<string>();
    let blendAnimationFrame = 0;
    let layoutAnimationFrame = 0;
    let scrollAnimationFrame = 0;
    let lastLayoutSampleAt = 0;
    let viewportMetricsDirty = false;
    const state: InitialGlyphFrameState = {
      disposed: false,
      modifiers: [],
      posters: options.modifierPosters,
      registerModifier: (): void => {
        /* Assigned below. */
      },
    };
    const renderFrame = (): void => {
      gl.useProgram(program);
      gl.bindVertexArray(vertexArray);
      gl.clearColor(red, green, blue, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cellCount);
    };
    const updateDocumentAnchor = (forceGridResize = false): boolean => {
      if (!options.documentAnchor) {
        return false;
      }

      let didChange = false;
      // The absolute canvas is out of flow, so the body's box measures the
      // Content without feeding the canvas's own overscan back into it.
      documentHeight = Math.max(document.body.offsetHeight, largeViewportHeight);
      const overscanHeight = Math.round(largeViewportHeight * options.documentAnchorOverscan);
      const nextHeight = `${Math.min(overscanHeight, Math.floor(documentHeight))}px`;
      if (canvas.style.height !== nextHeight) {
        canvas.style.height = nextHeight;
        didChange = true;
      }
      didChange = resizeGrid(forceGridResize) || didChange;

      const viewportScrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const edgeMargin = viewportHeight * options.documentAnchorEdgeMargin;
      const maxTopRow = Math.max(0, Math.floor((documentHeight - cssHeight) / cellHeight));
      let nextTop = Math.min(canvasTop, maxTopRow * cellHeight);
      const isNearTop = nextTop > 0 && viewportScrollY < nextTop + edgeMargin;
      const isNearBottom =
        nextTop + cssHeight < documentHeight - cellHeight &&
        viewportScrollY + viewportHeight > nextTop + cssHeight - edgeMargin;
      if (isNearTop || isNearBottom) {
        const centeredTopRow = Math.floor(
          (viewportScrollY - (cssHeight - viewportHeight) / 2) / cellHeight,
        );
        nextTop = Math.min(maxTopRow, Math.max(0, centeredTopRow)) * cellHeight;
      }

      if (nextTop !== canvasTop) {
        canvasTop = nextTop;
        canvas.style.top = `${canvasTop}px`;
        uniform2f("u_grid_origin", 0, canvasTop);
        didChange = true;
      }

      return didChange;
    };
    const synchronizeViewportLayout = (): boolean => {
      const didRefreshMetrics = viewportMetricsDirty ? refreshViewportMetrics() : false;
      viewportMetricsDirty = false;
      const didResizeGrid = options.documentAnchor
        ? updateDocumentAnchor(didRefreshMetrics)
        : resizeGrid(didRefreshMetrics);

      return didRefreshMetrics || didResizeGrid;
    };
    const resolveSnappedModifierBounds = (
      bounds: DOMRect,
    ): Pick<InitialGlyphModifier, "documentLeft" | "documentTop" | "height" | "width"> => {
      // This function is serialized without module imports. Keep this cell
      // Envelope calculation equivalent to snapGlyphFieldModifierBounds.
      const snapAxis = (
        start: number,
        length: number,
        origin: number,
        cellSize: number,
      ): { length: number; start: number } => {
        const firstCell = Math.ceil((start - origin) / cellSize - 0.5);
        const exclusiveEndCell = Math.ceil((start + length - origin) / cellSize - 0.5);

        return exclusiveEndCell <= firstCell
          ? { length: cellSize, start: origin + firstCell * cellSize }
          : {
              length: (exclusiveEndCell - firstCell) * cellSize,
              start: origin + firstCell * cellSize,
            };
      };
      const measuredDocumentLeft = bounds.left + window.scrollX;
      const measuredDocumentTop = bounds.top + window.scrollY;
      const horizontal = snapAxis(measuredDocumentLeft, bounds.width, 0, cellWidth);
      const vertical = snapAxis(measuredDocumentTop, bounds.height, canvasTop, cellHeight);

      return {
        documentLeft: horizontal.start,
        documentTop: vertical.start,
        height: vertical.length,
        width: horizontal.length,
      };
    };
    const updateModifierBounds = (): boolean => {
      let didChange = false;

      for (const modifier of state.modifiers) {
        const element = document.getElementById(modifier.elementId);
        if (!element) {
          continue;
        }

        const bounds = element.getBoundingClientRect();
        const snappedBounds = resolveSnappedModifierBounds(bounds);
        if (
          modifier.documentLeft === snappedBounds.documentLeft &&
          modifier.documentTop === snappedBounds.documentTop &&
          modifier.width === snappedBounds.width &&
          modifier.height === snappedBounds.height
        ) {
          continue;
        }

        modifier.documentLeft = snappedBounds.documentLeft;
        modifier.documentTop = snappedBounds.documentTop;
        modifier.width = snappedBounds.width;
        modifier.height = snappedBounds.height;
        didChange = true;
      }

      return didChange;
    };
    const updateModifierBlends = (): boolean => {
      let didChange = false;

      for (const modifier of state.modifiers) {
        const element = document.getElementById(modifier.elementId);
        if (!element) {
          continue;
        }

        const opacity = Number(getComputedStyle(element).opacity);
        const nextBlend =
          modifier.baseBlend * (Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1);
        if (Math.abs(modifier.blend - nextBlend) <= 0.001) {
          continue;
        }

        modifier.blend = nextBlend;
        didChange = true;
      }

      return didChange;
    };
    const uploadModifiers = (): void => {
      modifierBrightness.fill(0);
      modifierBlends.fill(0);
      modifierRects.fill(0);

      for (
        let index = 0;
        index < Math.min(state.modifiers.length, options.maxFieldModifierRegions);
        index += 1
      ) {
        const modifier = state.modifiers[index];
        const valueIndex = index * 4;
        modifierRects[valueIndex] = modifier.documentLeft;
        modifierRects[valueIndex + 1] = modifier.documentTop;
        modifierRects[valueIndex + 2] = modifier.width;
        modifierRects[valueIndex + 3] = modifier.height;
        modifierBlends[index] = modifier.blend;
        modifierBrightness.set(
          modifier.brightnessGrid,
          index * options.fieldModifierSampleSize ** 2,
        );
      }

      gl.useProgram(program);
      const countLocation = gl.getUniformLocation(program, "u_field_modifier_count");
      const blendsLocation = gl.getUniformLocation(program, "u_field_modifier_blends[0]");
      const rectsLocation = gl.getUniformLocation(program, "u_field_modifier_rects[0]");
      if (countLocation) {
        gl.uniform1i(
          countLocation,
          Math.min(state.modifiers.length, options.maxFieldModifierRegions),
        );
      }
      if (blendsLocation) {
        gl.uniform1fv(blendsLocation, modifierBlends);
      }
      if (rectsLocation) {
        gl.uniform4fv(rectsLocation, modifierRects);
      }
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, fieldModifierTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        options.fieldModifierSampleSize,
        options.fieldModifierSampleSize * options.maxFieldModifierRegions,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        modifierBrightness,
      );
      renderFrame();
    };
    const synchronizeModifierLayout = (time: number): void => {
      if (state.disposed) {
        return;
      }

      if (
        document.readyState === "loading" ||
        time - lastLayoutSampleAt >= 1000 / options.layoutSampleRate
      ) {
        lastLayoutSampleAt = time;
        const didUpdateViewportLayout = synchronizeViewportLayout();
        const didUpdateModifierBounds = updateModifierBounds();
        const didUpdateModifierBlends = updateModifierBlends();
        if (didUpdateModifierBounds || didUpdateModifierBlends) {
          uploadModifiers();
        } else if (didUpdateViewportLayout) {
          renderFrame();
        }
      }

      layoutAnimationFrame = requestAnimationFrame(synchronizeModifierLayout);
    };
    const synchronizeModifierBlendTransition = (): void => {
      blendAnimationFrame = 0;
      if (state.disposed) {
        return;
      }

      if (updateModifierBlends()) {
        uploadModifiers();
      }
      if (activeModifierBlendTransitions.size > 0) {
        blendAnimationFrame = requestAnimationFrame(synchronizeModifierBlendTransition);
      }
    };
    const onModifierBlendTransitionChanged = (event: TransitionEvent): void => {
      if (event.propertyName !== "opacity") {
        return;
      }

      const element = event.target;
      if (
        !(element instanceof HTMLElement) ||
        !state.modifiers.some((modifier) => modifier.elementId === element.id)
      ) {
        return;
      }

      if (event.type === "transitionrun") {
        activeModifierBlendTransitions.add(element.id);
      } else {
        activeModifierBlendTransitions.delete(element.id);
      }
      if (blendAnimationFrame === 0) {
        blendAnimationFrame = requestAnimationFrame(synchronizeModifierBlendTransition);
      }
    };
    const onDocumentScroll = (): void => {
      if (scrollAnimationFrame !== 0 || state.disposed) {
        return;
      }

      scrollAnimationFrame = requestAnimationFrame((): void => {
        scrollAnimationFrame = 0;
        if (!state.disposed && updateDocumentAnchor()) {
          renderFrame();
        }
      });
    };
    const onWindowResize = (): void => {
      if (state.disposed) {
        return;
      }

      viewportMetricsDirty = true;
      lastLayoutSampleAt = 0;
      if (layoutAnimationFrame === 0) {
        layoutAnimationFrame = requestAnimationFrame(synchronizeModifierLayout);
      }
    };
    state.registerModifier = (modifierOptions: InitialGlyphModifierOptions): void => {
      const poster = state.posters[modifierOptions.sourceUrl];
      if (!poster) {
        return;
      }

      const encoded = atob(poster.data);
      const sourceCellCount = poster.cols * poster.rows;
      const encodedCellCount = Math.ceil(sourceCellCount / 2);
      if (encoded.length < encodedCellCount) {
        return;
      }

      const brightnessGrid = new Uint8Array(options.fieldModifierSampleSize ** 2);
      for (let row = 0; row < options.fieldModifierSampleSize; row += 1) {
        const sourceRow = Math.min(
          poster.rows - 1,
          Math.floor(((row + 0.5) * poster.rows) / options.fieldModifierSampleSize),
        );
        for (let col = 0; col < options.fieldModifierSampleSize; col += 1) {
          const sourceCol = Math.min(
            poster.cols - 1,
            Math.floor(((col + 0.5) * poster.cols) / options.fieldModifierSampleSize),
          );
          const sourceIndex = sourceRow * poster.cols + sourceCol;
          const encodedValue = encoded.charCodeAt(sourceIndex >> 1);
          brightnessGrid[row * options.fieldModifierSampleSize + col] =
            ((sourceIndex % 2 === 0 ? encodedValue & 15 : encodedValue >> 4) * 255) / 15;
        }
      }

      const element = document.getElementById(modifierOptions.elementId);
      const bounds = element?.getBoundingClientRect();
      const snappedBounds = bounds ? resolveSnappedModifierBounds(bounds) : null;
      const opacity = element ? Number(getComputedStyle(element).opacity) : 1;
      const modifier: InitialGlyphModifier = {
        baseBlend: modifierOptions.blend,
        blend:
          modifierOptions.blend *
          (Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1),
        brightnessGrid,
        documentLeft: snappedBounds?.documentLeft ?? 0,
        documentTop: snappedBounds?.documentTop ?? 0,
        elementId: modifierOptions.elementId,
        height: snappedBounds?.height ?? 0,
        width: snappedBounds?.width ?? 0,
      };
      const existingIndex = state.modifiers.findIndex(
        (candidate) => candidate.elementId === modifier.elementId,
      );
      if (existingIndex === -1) {
        state.modifiers.push(modifier);
      } else {
        state.modifiers[existingIndex] = modifier;
      }

      if (!state.disposed) {
        uploadModifiers();
        if (layoutAnimationFrame === 0) {
          layoutAnimationFrame = requestAnimationFrame(synchronizeModifierLayout);
        }
      }
      window.dispatchEvent(new CustomEvent("glyphinitialmodifier", { detail: modifier }));
    };

    initialFrameGlobal.__glyphInitialFrame = state;
    document.addEventListener("transitionrun", onModifierBlendTransitionChanged);
    document.addEventListener("transitionend", onModifierBlendTransitionChanged);
    document.addEventListener("transitioncancel", onModifierBlendTransitionChanged);
    window.addEventListener("resize", onWindowResize, { passive: true });
    if (options.documentAnchor) {
      updateDocumentAnchor();
      window.addEventListener("scroll", onDocumentScroll, { passive: true });
      layoutAnimationFrame = requestAnimationFrame(synchronizeModifierLayout);
    }
    renderFrame();
    for (const modifier of initialFrameGlobal.__glyphInitialFrameQueue ?? []) {
      state.registerModifier(modifier);
    }
    delete initialFrameGlobal.__glyphInitialFrameQueue;
    canvas.dataset.glyphInitialFrame = "";
    canvas.__disposeGlyphInitialFrame = (): void => {
      state.disposed = true;
      cancelAnimationFrame(blendAnimationFrame);
      cancelAnimationFrame(layoutAnimationFrame);
      cancelAnimationFrame(scrollAnimationFrame);
      document.removeEventListener("transitionrun", onModifierBlendTransitionChanged);
      document.removeEventListener("transitionend", onModifierBlendTransitionChanged);
      document.removeEventListener("transitioncancel", onModifierBlendTransitionChanged);
      window.removeEventListener("scroll", onDocumentScroll);
      window.removeEventListener("resize", onWindowResize);
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
    | "documentAnchorEdgeMargin"
    | "documentAnchorOverscan"
    | "fontFamily"
    | "fragmentSource"
    | "glyphCellPaddingRatio"
    | "layoutSampleRate"
    | "maxFieldModifierRegions"
    | "vertexSource"
  >,
): string {
  const { fragmentSource, vertexSource } = createGlyphRasterShaderSources(
    GLYPH_RASTER_SHADER_OPTIONS,
  );
  const serializedOptions = JSON.stringify({
    ...options,
    documentAnchorEdgeMargin: DOCUMENT_ANCHOR_EDGE_MARGIN,
    documentAnchorOverscan: DOCUMENT_ANCHOR_OVERSCAN,
    fieldModifierSampleSize: FIELD_MODIFIER_SAMPLE_SIZE,
    glyphCellPaddingRatio: GLYPH_CELL_PADDING_RATIO,
    layoutSampleRate: PROCEDURAL_LAYOUT_SAMPLE_RATE,
    fontFamily: GLYPH_FONT_FAMILY,
    fragmentSource,
    maxFieldModifierRegions: MAX_FIELD_MODIFIER_REGIONS,
    vertexSource,
  }).replaceAll("<", "\\u003c");

  return `(${drawInitialGlyphFrame.toString()})(${serializedOptions});`;
}

function createInitialGlyphModifierScript(options: InitialGlyphModifierOptions): string {
  const serializedOptions = JSON.stringify(options).replaceAll("<", "\\u003c");

  return `((scope,modifier)=>{const frame=scope.__glyphInitialFrame;if(frame){frame.registerModifier(modifier);}else{(scope.__glyphInitialFrameQueue??=[]).push(modifier);}})(globalThis,${serializedOptions});`;
}

export { createInitialGlyphFrameScript, createInitialGlyphModifierScript };
