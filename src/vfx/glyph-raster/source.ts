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

interface StreamFrameModifierBrightnessGridsParams {
  onFrame?: (frame: number, grids: FrameModifierBrightnessGrids) => void;
  source: GlyphRasterFrameSource;
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

function parseFrameSourceHeader(raw: Uint8Array, sourceUrl: string): ParsedSourceHeader {
  const headerEnd = raw.indexOf(10);
  if (headerEnd === -1) {
    throw new Error(`Unable to parse character animation frames from ${sourceUrl}.`);
  }

  return JSON.parse(new TextDecoder().decode(raw.subarray(0, headerEnd))) as ParsedSourceHeader;
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

async function createFrameModifierBrightnessGrids({
  onFrame,
  source,
}: StreamFrameModifierBrightnessGridsParams): Promise<FrameModifierBrightnessGrids> {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Unable to load character animation frames from ${source.url}.`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const frameSource = parseSourceHeader(bytes, source.url);
    const sampledFrameSize = FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;
    const grids = new Uint8Array(frameSource.frameCount * sampledFrameSize);

    for (let frame = 0; frame < frameSource.frameCount; frame += 1) {
      const sampledFrameOffset = frame * sampledFrameSize;
      for (let row = 0; row < FIELD_MODIFIER_SAMPLE_SIZE; row += 1) {
        for (let col = 0; col < FIELD_MODIFIER_SAMPLE_SIZE; col += 1) {
          grids[sampledFrameOffset + row * FIELD_MODIFIER_SAMPLE_SIZE + col] =
            sampleFrameBrightness({
              cellColumnIndex: col,
              cellRowIndex: row,
              frame,
              frameSource,
            });
        }
      }
    }

    const result = {
      aspectRatio: frameSource.aspectRatio,
      defaultFps: frameSource.defaultFps,
      frameCount: frameSource.frameCount,
      grids,
    };
    setCachedValue({
      cache: frameBrightnessCache,
      key: [
        source.url,
        "modifier",
        frameSource.cols,
        frameSource.rows,
        frameSource.frameCount,
        FIELD_MODIFIER_SAMPLE_SIZE,
      ].join(":"),
      maxSize: MAX_FRAME_BRIGHTNESS_CACHE_SIZE,
      value: grids,
    });
    onFrame?.(0, result);
    return result;
  }

  let headerBytes = new Uint8Array();
  let frameBytes = new Uint8Array();
  let frameSource: Omit<ParsedFrameSource, "frames"> | null = null;
  let grids: Uint8Array | null = null;
  let frame = 0;
  const sampledFrameSize = FIELD_MODIFIER_SAMPLE_SIZE * FIELD_MODIFIER_SAMPLE_SIZE;
  const appendBytes = (current: Uint8Array, next: Uint8Array): Uint8Array => {
    const combined = new Uint8Array(current.length + next.length);
    combined.set(current);
    combined.set(next, current.length);
    return combined;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    let remaining = value;
    if (!frameSource) {
      headerBytes = appendBytes(headerBytes, remaining);
      const headerEnd = headerBytes.indexOf(10);
      if (headerEnd === -1) {
        continue;
      }

      const header = parseFrameSourceHeader(headerBytes, source.url);
      const frameSize = header.cols * header.rows;
      frameSource = {
        aspectRatio:
          ((header.cols / GLYPH_HORIZONTAL_SCALE) * NOISE_CELL_WIDTH) /
          (header.rows * NOISE_CELL_HEIGHT),
        cols: header.cols,
        defaultFps: header.fps ?? DEFAULT_FRAME_RATE,
        frameCount: header.n_frames,
        frameSize,
        rows: header.rows,
      };
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
        const result = {
          aspectRatio: frameSource.aspectRatio,
          defaultFps: frameSource.defaultFps,
          frameCount: frameSource.frameCount,
          grids: cachedGrids,
        };
        await reader.cancel();
        onFrame?.(0, result);
        return result;
      }
      grids = new Uint8Array(frameSource.frameCount * sampledFrameSize);
      remaining = headerBytes.subarray(headerEnd + 1);
      headerBytes = new Uint8Array();
    }

    frameBytes = appendBytes(frameBytes, remaining);
    while (
      frameSource &&
      grids &&
      frameBytes.length >= frameSource.frameSize &&
      frame < frameSource.frameCount
    ) {
      const sourceFrame = frameBytes.subarray(0, frameSource.frameSize);
      const sampledFrameOffset = frame * sampledFrameSize;

      for (let row = 0; row < FIELD_MODIFIER_SAMPLE_SIZE; row += 1) {
        const sourceRow = Math.min(
          frameSource.rows - 1,
          Math.floor(((row + 0.5) * frameSource.rows) / FIELD_MODIFIER_SAMPLE_SIZE),
        );
        for (let col = 0; col < FIELD_MODIFIER_SAMPLE_SIZE; col += 1) {
          const sourceCol = Math.min(
            frameSource.cols - 1,
            Math.floor(((col + 0.5) * frameSource.cols) / FIELD_MODIFIER_SAMPLE_SIZE),
          );
          grids[sampledFrameOffset + row * FIELD_MODIFIER_SAMPLE_SIZE + col] =
            sourceFrame[sourceRow * frameSource.cols + sourceCol] ?? 0;
        }
      }

      onFrame?.(frame, {
        aspectRatio: frameSource.aspectRatio,
        defaultFps: frameSource.defaultFps,
        frameCount: frameSource.frameCount,
        grids,
      });
      frame += 1;
      frameBytes = frameBytes.subarray(frameSource.frameSize);
    }
  }

  if (!frameSource || !grids || frame !== frameSource.frameCount) {
    throw new Error(`Unable to load all character animation frames from ${source.url}.`);
  }

  const cacheKey = [
    source.url,
    "modifier",
    frameSource.cols,
    frameSource.rows,
    frameSource.frameCount,
    FIELD_MODIFIER_SAMPLE_SIZE,
  ].join(":");

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
  resolveSource,
  FIELD_MODIFIER_SAMPLE_SIZE,
  parseSourceHeader,
  setCachedValue,
  getCachedValue,
  type GlyphRasterFrameSource,
  type GlyphRasterNoiseSource,
  type GlyphRasterSource,
  type FrameModifierBrightnessGrids,
  type SampleFrameBrightnessParams,
};
