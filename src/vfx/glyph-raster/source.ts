import { solarSurfaceBrightness } from "src/vfx/solar-noise/cpu";

interface GlyphRasterFrameSource {
  type: "frames";
  url: string;
}

interface GlyphRasterNoiseSource {
  type: "procedural-noise";
}

type GlyphRasterSource = GlyphRasterFrameSource | GlyphRasterNoiseSource;

interface ParsedFrameSource {
  aspectRatio: number;
  defaultFps: number;
  frameCount: number;
  frameSize: number;
  frames: Uint8Array;
  cols: number;
  rows: number;
}

interface FrameModifierBrightnessGrids {
  aspectRatio: number;
  defaultFps: number;
  frameCount: number;
  grids: Uint8Array;
}

interface SourceAdapter {
  defaultFps?: number;
  frameCount?: number;
  getBrightness: (col: number, row: number, cols: number, rows: number, time: number, frame: number) => number;
  gpuNoiseSeed?: number;
  resize?: (cols: number, rows: number) => void;
}

interface ParsedSourceHeader {
  cols: number;
  fps?: number;
  n_frames: number;
  rows: number;
}

interface SetCachedValueParams<Value> {
  cache: Map<string, Value>;
  key: string;
  maxSize: number;
  value: Value;
}

interface SampleFrameBrightnessParams {
  cellColumnIndex: number;
  frame: number;
  frameSource: ParsedFrameSource;
  cellRowIndex: number;
}

const GLYPH_HORIZONTAL_SCALE = 1.09;
const NOISE_CELL_WIDTH = 8;
const NOISE_CELL_HEIGHT = 14;
const DEFAULT_FRAME_RATE = 18;
const FIELD_MODIFIER_SAMPLE_SIZE = 256;
const MAX_FRAME_BRIGHTNESS_CACHE_SIZE = 8;
const frameBrightnessCache = new Map<string, Uint8Array>();

function getCachedValue<Value>(cache: Map<string, Value>, key: string): Value | null {
  const value = cache.get(key);
  if (typeof value === "undefined") {
    return null;
  }

  cache.delete(key);
  cache.set(key, value);

  return value;
}

function setCachedValue<Value>(params: SetCachedValueParams<Value>): void {
  const { cache, key, maxSize, value } = params;
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

function parseSourceHeader(raw: Uint8Array, sourceUrl: string): ParsedFrameSource {
  const headerEnd = raw.indexOf(10);
  if (headerEnd === -1) {
    throw new Error(`Unable to parse character animation frames from ${sourceUrl}.`);
  }

  const header = JSON.parse(
    new TextDecoder().decode(raw.subarray(0, headerEnd)),
  ) as ParsedSourceHeader;
  const frames = raw.subarray(headerEnd + 1);
  const frameSize = header.cols * header.rows;

  return {
    aspectRatio:
      ((header.cols / GLYPH_HORIZONTAL_SCALE) * NOISE_CELL_WIDTH) /
      (header.rows * NOISE_CELL_HEIGHT),
    cols: header.cols,
    defaultFps: header.fps ?? DEFAULT_FRAME_RATE,
    frameCount: header.n_frames,
    frameSize,
    frames,
    rows: header.rows,
  };
}

async function loadFrameSource(source: GlyphRasterFrameSource): Promise<ParsedFrameSource> {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Unable to load character animation frames from ${source.url}.`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  return parseSourceHeader(bytes, source.url);
}

function sampleFrameBrightness({
  cellColumnIndex,
  frame,
  frameSource,
  cellRowIndex,
}: SampleFrameBrightnessParams): number {
  const sourceFrameOffset = frame * frameSource.frameSize;
  const sourceRow = Math.min(
    frameSource.rows - 1,
    Math.floor(((cellRowIndex + 0.5) * frameSource.rows) / FIELD_MODIFIER_SAMPLE_SIZE),
  );
  const sourceCol = Math.min(
    frameSource.cols - 1,
    Math.floor(((cellColumnIndex + 0.5) * frameSource.cols) / FIELD_MODIFIER_SAMPLE_SIZE),
  );

  return frameSource.frames[sourceFrameOffset + sourceRow * frameSource.cols + sourceCol];
}

function resolveSource(source: GlyphRasterSource | undefined): GlyphRasterSource {
  if (source) {
    return source;
  }

  return { type: "procedural-noise" };
}

function createNoiseAdapter(): SourceAdapter {
  const seed = Math.floor(Math.random() * 0xFF_FF_FF_FF);

  return {
    defaultFps: DEFAULT_FRAME_RATE,
    getBrightness: (col, row, _cols, _rows, time): number =>
      solarSurfaceBrightness({
        columnIndex: col,
        noiseSeed: seed,
        rowIndex: row,
        time,
      }),
    gpuNoiseSeed: seed,
  };
}

async function createFrameModifierBrightnessGrids(
  source: GlyphRasterFrameSource,
): Promise<FrameModifierBrightnessGrids> {
  const frameSource = await loadFrameSource(source);
  const sampledFrameSize = FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;
  const cacheKey = [
    source.url,
    "modifier",
    frameSource.cols,
    frameSource.rows,
    frameSource.frameCount,
    FIELD_MODIFIER_SAMPLE_SIZE,
  ].join(":");
  const cachedGrids = getCachedValue(frameBrightnessCache, cacheKey);
  if (cachedGrids) {
    return {
      aspectRatio: frameSource.aspectRatio,
      defaultFps: frameSource.defaultFps,
      frameCount: frameSource.frameCount,
      grids: cachedGrids,
    };
  }

  const grids = new Uint8Array(frameSource.frameCount * sampledFrameSize);

  for (let frame = 0; frame < frameSource.frameCount; frame += 1) {
    const sampledFrameOffset = frame * sampledFrameSize;

    for (let row = 0; row < FIELD_MODIFIER_SAMPLE_SIZE; row += 1) {
      for (let col = 0; col < FIELD_MODIFIER_SAMPLE_SIZE; col += 1) {
        const value = sampleFrameBrightness({
          cellColumnIndex: col,
          cellRowIndex: row,
          frame,
          frameSource,
        });
        grids[sampledFrameOffset + row * FIELD_MODIFIER_SAMPLE_SIZE + col] = value;
      }
    }
  }

  setCachedValue({
    cache: frameBrightnessCache,
    key: cacheKey,
    maxSize: MAX_FRAME_BRIGHTNESS_CACHE_SIZE,
    value: grids,
  });

  return {
    aspectRatio: frameSource.aspectRatio,
    defaultFps: frameSource.defaultFps,
    frameCount: frameSource.frameCount,
    grids,
  };
}

export {
  createFrameModifierBrightnessGrids,
  createNoiseAdapter,
  resolveSource,
  FIELD_MODIFIER_SAMPLE_SIZE,
  parseSourceHeader,
  setCachedValue,
  getCachedValue,
  type SourceAdapter,
  type GlyphRasterFrameSource,
  type GlyphRasterNoiseSource,
  type GlyphRasterSource,
  type FrameModifierBrightnessGrids,
  type SampleFrameBrightnessParams,
};
