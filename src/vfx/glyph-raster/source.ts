export type GlyphRasterFrameSource = {
  type: "frames";
  url: string;
};

export type GlyphRasterNoiseSource = {
  type: "procedural-noise";
};

export type GlyphRasterSource = GlyphRasterFrameSource | GlyphRasterNoiseSource;

import { solarSurfaceBrightness } from "src/vfx/solar-noise/cpu";

type ParsedFrameSource = {
  aspectRatio: number;
  defaultFps: number;
  frameCount: number;
  frameSize: number;
  frames: Uint8Array;
  cols: number;
  rows: number;
};

export type FrameModifierBrightnessGrids = {
  aspectRatio: number;
  defaultFps: number;
  frameCount: number;
  grids: Uint8Array;
};

type SourceAdapter = {
  defaultFps?: number;
  frameCount?: number;
  getBrightness: (
    col: number,
    row: number,
    cols: number,
    rows: number,
    time: number,
    frame: number,
  ) => number;
  gpuNoiseSeed?: number;
  resize?: (cols: number, rows: number) => void;
};

const GLYPH_HORIZONTAL_SCALE = 1.09;
const NOISE_CELL_WIDTH = 8;
const NOISE_CELL_HEIGHT = 14;
const DEFAULT_FRAME_RATE = 18;
const FIELD_MODIFIER_SAMPLE_SIZE = 256;
const MAX_FRAME_BRIGHTNESS_CACHE_SIZE = 8;
const frameBrightnessCache = new Map<string, Uint8Array>();

const getCachedValue = <Value>(cache: Map<string, Value>, key: string): Value | undefined => {
  const value = cache.get(key);
  if (value === undefined) return undefined;

  cache.delete(key);
  cache.set(key, value);

  return value;
};

const setCachedValue = <Value>(
  cache: Map<string, Value>,
  key: string,
  value: Value,
  maxSize: number,
): void => {
  cache.delete(key);
  cache.set(key, value);

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) return;

    cache.delete(oldestKey);
  }
};

export const resolveSource = (source: GlyphRasterSource | undefined): GlyphRasterSource => {
  if (source) return source;

  return { type: "procedural-noise" };
};

export const createNoiseAdapter = (): SourceAdapter => {
  const seed = Math.floor(Math.random() * 0xffffffff);

  return {
    defaultFps: DEFAULT_FRAME_RATE,
    getBrightness: (col, row, _cols, _rows, time) => solarSurfaceBrightness(col, row, time, seed),
    gpuNoiseSeed: seed,
  };
};

const loadFrameSource = async (source: GlyphRasterFrameSource): Promise<ParsedFrameSource> => {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Unable to load character animation frames from ${source.url}.`);
  }

  const raw = new Uint8Array(await response.arrayBuffer());
  const headerEnd = raw.indexOf(10);

  if (headerEnd < 0) {
    throw new Error(`Unable to parse character animation frames from ${source.url}.`);
  }

  const header = JSON.parse(new TextDecoder().decode(raw.subarray(0, headerEnd))) as {
    cols: number;
    fps?: number;
    n_frames: number;
    rows: number;
  };
  const frames = raw.subarray(headerEnd + 1);
  const frameSize = header.cols * header.rows;
  const horizontalScale = GLYPH_HORIZONTAL_SCALE;

  return {
    aspectRatio:
      ((header.cols / horizontalScale) * NOISE_CELL_WIDTH) / (header.rows * NOISE_CELL_HEIGHT),
    cols: header.cols,
    defaultFps: header.fps ?? DEFAULT_FRAME_RATE,
    frameCount: header.n_frames,
    frameSize,
    frames,
    rows: header.rows,
  };
};

const sampleFrameBrightness = (
  frameSource: ParsedFrameSource,
  frame: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
): number => {
  const sourceFrameOffset = frame * frameSource.frameSize;
  const sourceRow = Math.min(
    frameSource.rows - 1,
    Math.floor(((row + 0.5) * frameSource.rows) / rows),
  );
  const sourceCol = Math.min(
    frameSource.cols - 1,
    Math.floor(((col + 0.5) * frameSource.cols) / cols),
  );

  return frameSource.frames[sourceFrameOffset + sourceRow * frameSource.cols + sourceCol];
};

export const createFrameModifierBrightnessGrids = async (
  source: GlyphRasterFrameSource,
): Promise<FrameModifierBrightnessGrids> => {
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
        grids[sampledFrameOffset + row * FIELD_MODIFIER_SAMPLE_SIZE + col] = sampleFrameBrightness(
          frameSource,
          frame,
          col,
          row,
          FIELD_MODIFIER_SAMPLE_SIZE,
          FIELD_MODIFIER_SAMPLE_SIZE,
        );
      }
    }
  }

  setCachedValue(frameBrightnessCache, cacheKey, grids, MAX_FRAME_BRIGHTNESS_CACHE_SIZE);

  return {
    aspectRatio: frameSource.aspectRatio,
    defaultFps: frameSource.defaultFps,
    frameCount: frameSource.frameCount,
    grids,
  };
};
