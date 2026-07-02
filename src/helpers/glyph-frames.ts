import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";

import sharp, { type Sharp } from "sharp";

type GlyphFrameSource = {
  fps: number;
  output: string;
  rows: number;
  source: string;
};

type VideoMetadata = {
  streams?: Array<{
    height?: number;
    width?: number;
  }>;
};

type FrameDimensions = {
  cols: number;
  rows: number;
};

const GLYPH_CELL_WIDTH = 8;
const GLYPH_CELL_HEIGHT = 14;
const GLYPH_HORIZONTAL_SCALE = 1.09;
const DITHER_MATRIX_SIZE = 4;
const DITHER_BYTE_SPREAD = 0.75;
const DETAIL_SHARPEN_AMOUNT = 0.72;
const MIN_CONTRAST_RANGE = 0.003;
const SHADOW_PERCENTILE = 0.02;
const HIGHLIGHT_PERCENTILE = 0.98;
const VIDEO_EXTENSIONS = new Set([".avi", ".gif", ".m4v", ".mkv", ".mov", ".mp4", ".webm"]);
const DITHER_MATRIX = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function getFrameDimensions(width: number, height: number, rows: number): FrameDimensions {
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid glyph frame source dimensions: ${width}x${height}.`);
  }

  const aspectRatio = width / height;
  const cols = Math.max(
    1,
    Math.round(
      (aspectRatio * rows * GLYPH_CELL_HEIGHT * GLYPH_HORIZONTAL_SCALE) / GLYPH_CELL_WIDTH,
    ),
  );

  return { cols, rows };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;

  if (normalized <= 0.04045) return normalized / 12.92;

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const clamped = clamp(value, 0, 1);

  if (clamped <= 0.0031308) return clamped * 12.92;

  return 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function getLuminance(red: number, green: number, blue: number, alpha = 1): number {
  const linearLuminance =
    srgbToLinear(red) * 0.2126 + srgbToLinear(green) * 0.7152 + srgbToLinear(blue) * 0.0722;

  return linearToSrgb(linearLuminance) * alpha;
}

function blurBrightness(values: Float32Array, width: number, height: number): Float32Array {
  const blurred = new Float32Array(values.length);

  for (let row = 0; row < height; row += 1) {
    const top = Math.max(0, row - 1);
    const bottom = Math.min(height - 1, row + 1);

    for (let col = 0; col < width; col += 1) {
      const left = Math.max(0, col - 1);
      const right = Math.min(width - 1, col + 1);
      let total = 0;
      let count = 0;

      for (let sampleRow = top; sampleRow <= bottom; sampleRow += 1) {
        for (let sampleCol = left; sampleCol <= right; sampleCol += 1) {
          total += values[sampleRow * width + sampleCol];
          count += 1;
        }
      }

      blurred[row * width + col] = total / count;
    }
  }

  return blurred;
}

function getHistogramPercentile(histogram: Uint32Array, total: number, percentile: number): number {
  const threshold = Math.max(0, Math.min(total - 1, Math.floor(total * percentile)));
  let count = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    count += histogram[index];

    if (count > threshold) {
      return index / (histogram.length - 1);
    }
  }

  return 1;
}

function mapFrameToGlyphBrightness(
  values: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const blurred = blurBrightness(values, width, height);
  const mapped = new Float32Array(values.length);
  const histogram = new Uint32Array(256);
  let minBrightness = 1;
  let maxBrightness = 0;

  for (let index = 0; index < values.length; index += 1) {
    const sharpened = clamp(
      values[index] + (values[index] - blurred[index]) * DETAIL_SHARPEN_AMOUNT,
      0,
      1,
    );

    mapped[index] = sharpened;
    histogram[Math.round(sharpened * 255)] += 1;
    minBrightness = Math.min(minBrightness, sharpened);
    maxBrightness = Math.max(maxBrightness, sharpened);
  }

  let blackPoint = getHistogramPercentile(histogram, mapped.length, SHADOW_PERCENTILE);
  let whitePoint = getHistogramPercentile(histogram, mapped.length, HIGHLIGHT_PERCENTILE);
  let range = whitePoint - blackPoint;

  if (range < MIN_CONTRAST_RANGE) {
    blackPoint = minBrightness;
    whitePoint = maxBrightness;
    range = whitePoint - blackPoint;
  }

  if (range < MIN_CONTRAST_RANGE) {
    mapped.fill(0.5);
    return mapped;
  }

  for (let index = 0; index < mapped.length; index += 1) {
    mapped[index] = clamp((mapped[index] - blackPoint) / range, 0, 1);
  }

  return mapped;
}

function ditherGlyphBrightness(value: number, col: number, row: number): number {
  const matrixIndex = (row % DITHER_MATRIX_SIZE) * DITHER_MATRIX_SIZE + (col % DITHER_MATRIX_SIZE);
  const threshold = DITHER_MATRIX[matrixIndex] / (DITHER_MATRIX_SIZE * DITHER_MATRIX_SIZE - 1);

  return clamp(value + ((threshold - 0.5) * DITHER_BYTE_SPREAD) / 255, 0, 1);
}

function createProcessedFrame(values: Float32Array, dimensions: FrameDimensions): Buffer {
  const mapped = mapFrameToGlyphBrightness(values, dimensions.cols, dimensions.rows);
  const frame = Buffer.alloc(mapped.length);

  for (let row = 0; row < dimensions.rows; row += 1) {
    for (let col = 0; col < dimensions.cols; col += 1) {
      const index = row * dimensions.cols + col;

      frame[index] = Math.round(ditherGlyphBrightness(mapped[index], col, row) * 255);
    }
  }

  return frame;
}

function processRawFrames(
  rawFrames: Buffer | Uint8Array,
  dimensions: FrameDimensions,
  channels: number,
): Buffer {
  const frameSize = dimensions.cols * dimensions.rows;
  const rawFrameSize = frameSize * channels;

  if (rawFrames.length === 0 || rawFrames.length % rawFrameSize !== 0) {
    throw new Error(
      `Generated raw frame byte count is ${rawFrames.length}, which is not divisible by ${rawFrameSize}.`,
    );
  }

  const processedFrames = Buffer.alloc((rawFrames.length / rawFrameSize) * frameSize);
  const brightness = new Float32Array(frameSize);

  for (let rawFrameOffset = 0, frameOffset = 0; rawFrameOffset < rawFrames.length; ) {
    for (let index = 0; index < frameSize; index += 1) {
      const pixelIndex = rawFrameOffset + index * channels;
      const alpha = channels >= 4 ? rawFrames[pixelIndex + 3] / 255 : 1;

      brightness[index] = getLuminance(
        rawFrames[pixelIndex],
        rawFrames[pixelIndex + 1],
        rawFrames[pixelIndex + 2],
        alpha,
      );
    }

    createProcessedFrame(brightness, dimensions).copy(processedFrames, frameOffset);
    rawFrameOffset += rawFrameSize;
    frameOffset += frameSize;
  }

  return processedFrames;
}

function getVideoDimensions(source: string, rows: number): FrameDimensions {
  const output = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      source,
    ],
    { encoding: "utf-8" },
  );
  const metadata = JSON.parse(output) as VideoMetadata;
  const stream = metadata.streams?.[0];

  if (!stream?.width || !stream.height) {
    throw new Error(`Could not read video dimensions for ${source}.`);
  }

  return getFrameDimensions(stream.width, stream.height, rows);
}

async function getImageDimensions(source: string, rows: number): Promise<FrameDimensions> {
  const metadata = await sharp(source).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions for ${source}.`);
  }

  return getFrameDimensions(metadata.width, metadata.height, rows);
}

function readVideoFrames(source: GlyphFrameSource, dimensions: FrameDimensions): Buffer {
  const rawFrames = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      source.source,
      "-an",
      "-sn",
      "-dn",
      "-vf",
      `fps=${source.fps},scale=${dimensions.cols}:${dimensions.rows}:flags=lanczos,format=rgb24`,
      "-f",
      "rawvideo",
      "-",
    ],
    { maxBuffer: 1024 * 1024 * 64 },
  );

  return processRawFrames(rawFrames, dimensions, 3);
}

async function readImageFrame(image: Sharp, dimensions: FrameDimensions): Promise<Buffer> {
  const { data } = await image
    .resize(dimensions.cols, dimensions.rows, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return processRawFrames(data, dimensions, 4);
}

function createFramesFile(fps: number, dimensions: FrameDimensions, rawFrames: Buffer): Buffer {
  const frameSize = dimensions.cols * dimensions.rows;

  if (rawFrames.length === 0 || rawFrames.length % frameSize !== 0) {
    throw new Error(
      `Generated frame byte count is ${rawFrames.length}, which is not divisible by ${frameSize}.`,
    );
  }

  const header = Buffer.from(
    `${JSON.stringify({
      cols: dimensions.cols,
      rows: dimensions.rows,
      fps,
      n_frames: rawFrames.length / frameSize,
    })}\n`,
  );

  return Buffer.concat([header, rawFrames]);
}

async function createImageGlyphFrames({
  fps,
  image,
  rows,
}: {
  fps: number;
  image: Sharp;
  rows: number;
}): Promise<Buffer> {
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions for glyph frames.");
  }

  const dimensions = getFrameDimensions(metadata.width, metadata.height, rows);
  const rawFrames = await readImageFrame(image.clone(), dimensions);

  return createFramesFile(fps, dimensions, rawFrames);
}

async function generateGlyphFrameSource(source: GlyphFrameSource): Promise<void> {
  const isVideo = VIDEO_EXTENSIONS.has(extname(source.source).toLowerCase());
  const dimensions = isVideo
    ? getVideoDimensions(source.source, source.rows)
    : await getImageDimensions(source.source, source.rows);
  const rawFrames = isVideo
    ? readVideoFrames(source, dimensions)
    : await readImageFrame(sharp(source.source), dimensions);
  const framesFile = createFramesFile(source.fps, dimensions, rawFrames);

  await mkdir(dirname(source.output), { recursive: true });
  await writeFile(source.output, framesFile);
  console.info(
    `Generated ${source.output} from ${source.source} (${dimensions.cols}x${dimensions.rows}, ${
      rawFrames.length / (dimensions.cols * dimensions.rows)
    } frame${rawFrames.length === dimensions.cols * dimensions.rows ? "" : "s"}).`,
  );
}

export { createImageGlyphFrames, generateGlyphFrameSource };
export type { GlyphFrameSource };
