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
const VIDEO_EXTENSIONS = new Set([".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"]);

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
  return execFileSync(
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
      `fps=${source.fps},scale=${dimensions.cols}:${dimensions.rows}:flags=lanczos,format=gray`,
      "-f",
      "rawvideo",
      "-",
    ],
    { maxBuffer: 1024 * 1024 * 64 },
  );
}

async function readImageFrame(image: Sharp, dimensions: FrameDimensions): Promise<Buffer> {
  const { data } = await image
    .resize(dimensions.cols, dimensions.rows, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frame = Buffer.alloc(dimensions.cols * dimensions.rows);

  for (let index = 0; index < frame.length; index += 1) {
    const pixelIndex = index * 4;
    const alpha = data[pixelIndex + 3] / 255;
    const brightness =
      ((data[pixelIndex] * 0.2126 + data[pixelIndex + 1] * 0.7152 + data[pixelIndex + 2] * 0.0722) /
        255) *
      alpha;

    frame[index] = Math.round(brightness * 255);
  }

  return frame;
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
