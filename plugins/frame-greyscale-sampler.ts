import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp, { type Sharp } from "sharp";
import type { Plugin, ResolvedConfig } from "vite";
import type {
  GlyphRasterFrameGrid,
  GlyphRasterFrameOptions,
} from "src/vfx/glyph-raster/frame-options";
import {
  GLYPH_FRAME_BRIGHTNESS_BITS,
  GLYPH_FRAME_ENCODING,
  GLYPH_FRAME_FORMAT_VERSION,
  encodePredictiveGlyphFrames,
  getPackedGlyphFrameSize,
} from "../src/vfx/glyph-raster/frame-codec";
import { createAssetContentHash } from "./asset-content-hash";

interface GlyphFrameSource {
  grid: GlyphRasterFrameGrid;
  output: string;
  source: string;
}

interface FrameDimensions {
  aspectRatio: number;
  cols: number;
  rows: number;
}

interface GlyphFramePoster {
  aspectRatio: number;
  cols: number;
  data: string;
  rows: number;
}

interface GlyphFrameHeader {
  aspect_ratio?: number;
  bits: number;
  cols: number;
  encoding: string;
  rows: number;
  version: number;
}

const DITHER_MATRIX_SIZE = 4;
const DITHER_BYTE_SPREAD = 0.75;
const DETAIL_SHARPEN_AMOUNT = 0.72;
const MIN_CONTRAST_RANGE = 0.003;
const SHADOW_PERCENTILE = 0.02;
const HIGHLIGHT_PERCENTILE = 0.98;
const DITHER_MATRIX = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const SITE_GLYPH_PUBLIC_DIRECTORY = "public";
const SITE_GLYPH_SOURCE_DIRECTORY = "src/routes/assets";
const SITE_GLYPH_SOURCE_EXTENSIONS = [".gif"];
const SITE_GLYPH_SOURCE_FILE_EXTENSIONS = new Set([".mdx", ".ts", ".tsx"]);
const SITE_GLYPH_FRAME_URL_REGEX = /["'`]\/(?<name>[\w-]+)\.frames["'`]/gu;
const GLYPH_FRAME_POSTERS_MODULE_ID = "virtual:glyph-frame-posters";
const RESOLVED_GLYPH_FRAME_POSTERS_MODULE_ID = `\0${GLYPH_FRAME_POSTERS_MODULE_ID}`;

function getFrameDimensions(
  width: number,
  height: number,
  options: GlyphRasterFrameOptions,
  grid: GlyphRasterFrameGrid,
): FrameDimensions {
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid glyph frame source dimensions: ${width}x${height}.`);
  }
  if (grid.cols <= 0 || (typeof grid.rows === "number" && grid.rows <= 0)) {
    throw new Error(`Invalid glyph frame sampling grid: ${grid.cols}x${grid.rows ?? "auto"}.`);
  }

  const sourceAspectRatio = width / height;
  const cols = Math.max(1, Math.round(grid.cols));
  const rows = Math.max(
    1,
    Math.round(grid.rows ?? (cols * options.cellWidth) / (sourceAspectRatio * options.cellHeight)),
  );
  const aspectRatio = (cols * options.cellWidth) / (rows * options.cellHeight);

  return { aspectRatio, cols, rows };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;

  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const clamped = clamp(value, 0, 1);

  if (clamped <= 0.0031308) {
    return clamped * 12.92;
  }

  return 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function getLuminance({
  red,
  green,
  blue,
  alpha = 1,
}: {
  red: number;
  green: number;
  blue: number;
  alpha?: number;
}): number {
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

  for (let frameOffset = 0, rawFrameOffset = 0; rawFrameOffset < rawFrames.length; ) {
    for (let index = 0; index < frameSize; index += 1) {
      const pixelIndex = rawFrameOffset + index * channels;
      const alpha = channels >= 4 ? rawFrames[pixelIndex + 3] / 255 : 1;

      brightness[index] = getLuminance({
        alpha,
        blue: rawFrames[pixelIndex + 2],
        green: rawFrames[pixelIndex + 1],
        red: rawFrames[pixelIndex],
      });
    }

    createProcessedFrame(brightness, dimensions).copy(processedFrames, frameOffset);
    rawFrameOffset += rawFrameSize;
    frameOffset += frameSize;
  }

  return processedFrames;
}

async function getImageDimensions(
  source: string,
  options: GlyphRasterFrameOptions,
  grid: GlyphRasterFrameGrid,
): Promise<FrameDimensions> {
  const metadata = await sharp(source, { animated: true }).metadata();
  const height = metadata.pageHeight ?? metadata.height;

  if (!metadata.width || !height) {
    throw new Error(`Could not read image dimensions for ${source}.`);
  }

  return getFrameDimensions(metadata.width, height, options, grid);
}

function getFrameRate(
  delays: number[] | null,
  processedFrames: Buffer,
  dimensions: FrameDimensions,
): number {
  const frameSize = dimensions.cols * dimensions.rows;
  const sourceFrameCount = processedFrames.length / frameSize;

  if (sourceFrameCount <= 1 || !delays || delays.length !== sourceFrameCount) {
    return 1;
  }

  const totalDuration = delays.reduce((total, delay): number => total + delay, 0);

  if (totalDuration <= 0) {
    return 1;
  }

  return sourceFrameCount / (totalDuration / 1000);
}

async function readImageFrames(
  image: Sharp,
  dimensions: FrameDimensions,
): Promise<{ fps: number; rawFrames: Buffer }> {
  const metadata = await image.metadata();
  const { data } = await image
    .resize(dimensions.cols, dimensions.rows, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rawFrames = processRawFrames(data, dimensions, 4);

  return {
    fps: getFrameRate(metadata.delay ?? null, rawFrames, dimensions),
    rawFrames,
  };
}

function createFramesFile(fps: number, dimensions: FrameDimensions, rawFrames: Buffer): Buffer {
  const frameSize = dimensions.cols * dimensions.rows;

  if (rawFrames.length === 0 || rawFrames.length % frameSize !== 0) {
    throw new Error(
      `Generated frame byte count is ${rawFrames.length}, which is not divisible by ${frameSize}.`,
    );
  }

  const encoded = encodePredictiveGlyphFrames(rawFrames, frameSize);

  const header = Buffer.from(
    `${JSON.stringify({
      aspect_ratio: dimensions.aspectRatio,
      bits: GLYPH_FRAME_BRIGHTNESS_BITS,
      cols: dimensions.cols,
      encoding: GLYPH_FRAME_ENCODING,
      fps,
      n_frames: rawFrames.length / frameSize,
      rows: dimensions.rows,
      version: GLYPH_FRAME_FORMAT_VERSION,
    })}\n`,
  );

  return Buffer.concat([header, encoded.payload]);
}

function createGlyphFramePoster(
  source: Buffer,
  options: GlyphRasterFrameOptions,
): GlyphFramePoster {
  const headerEnd = source.indexOf(10);
  if (headerEnd === -1) {
    throw new Error("Unable to parse glyph frame poster source.");
  }

  const header = JSON.parse(source.subarray(0, headerEnd).toString("utf8")) as GlyphFrameHeader;
  const frameSize = header.cols * header.rows;
  if (
    header.version !== GLYPH_FRAME_FORMAT_VERSION ||
    header.bits !== GLYPH_FRAME_BRIGHTNESS_BITS ||
    header.encoding !== GLYPH_FRAME_ENCODING
  ) {
    throw new Error(`Unsupported glyph frame poster format version ${header.version}.`);
  }

  const encodedFrameSize = getPackedGlyphFrameSize(frameSize);
  const frame = source.subarray(headerEnd + 1, headerEnd + 1 + encodedFrameSize);
  if (frame.length !== encodedFrameSize) {
    throw new Error("Glyph frame poster source does not contain a complete first frame.");
  }

  return {
    aspectRatio:
      header.aspect_ratio ??
      ((header.cols / options.horizontalScale) * options.cellWidth) /
        (header.rows * options.cellHeight),
    cols: header.cols,
    data: frame.toString("base64"),
    rows: header.rows,
  };
}

function readGlyphFrameFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entity): string[] => {
    const entry = path.join(directory, entity.name);

    if (entity.isDirectory()) {
      return readGlyphFrameFiles(entry);
    }

    return entity.isFile() && path.extname(entity.name) === ".frames" ? [entry] : [];
  });
}

function createGlyphFramePostersManifest(
  root: string,
  options: GlyphRasterFrameOptions,
): Record<string, GlyphFramePoster> {
  const publicDirectory = path.resolve(root, SITE_GLYPH_PUBLIC_DIRECTORY);

  return Object.fromEntries(
    readGlyphFrameFiles(publicDirectory).map((file): [string, GlyphFramePoster] => {
      const publicPath = `/${path.relative(publicDirectory, file).split(path.sep).join("/")}`;

      return [publicPath, createGlyphFramePoster(readFileSync(file), options)];
    }),
  );
}

async function generateGreyscaleFrameSource(
  source: GlyphFrameSource,
  options: GlyphRasterFrameOptions,
): Promise<string> {
  const dimensions = await getImageDimensions(source.source, options, source.grid);
  const { fps, rawFrames } = await readImageFrames(
    sharp(source.source, { animated: true }),
    dimensions,
  );
  const framesFile = createFramesFile(fps, dimensions, rawFrames);
  const { base, dir } = path.parse(source.output);
  const contentHash = createAssetContentHash(framesFile);
  const output = path.join(dir, `${contentHash}-${base}`);

  await mkdir(dir, { recursive: true });
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const isLogicalOutput = entry.name === base;
    const isHashedOutput =
      entry.name.endsWith(`-${base}`) && /^[\da-f]{16}(?:[\da-f]{48})?-/u.test(entry.name);

    if (entry.isFile() && (isLogicalOutput || isHashedOutput)) {
      await rm(path.join(dir, entry.name), { force: true });
    }
  }
  await writeFile(output, framesFile);

  return output;
}

function readSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entity): string[] => {
    const entry = path.join(directory, entity.name);

    if (entity.isDirectory()) {
      return readSourceFiles(entry);
    }

    if (!entity.isFile() || !SITE_GLYPH_SOURCE_FILE_EXTENSIONS.has(path.extname(entity.name))) {
      return [];
    }

    return [entry];
  });
}

function getSiteGlyphFrameNames(root: string): string[] {
  const sourceDirectory = path.resolve(root, "src");
  const names = new Set<string>();

  for (const sourceFile of readSourceFiles(sourceDirectory)) {
    const source = readFileSync(sourceFile, "utf8");

    for (const match of source.matchAll(SITE_GLYPH_FRAME_URL_REGEX)) {
      const name = match.groups ? match.groups.name : null;

      if (typeof name === "string") {
        names.add(name);
      }
    }
  }

  return [...names].sort();
}

function resolveSiteGlyphFrameSource(
  root: string,
  name: string,
  grid: GlyphRasterFrameGrid,
): GlyphFrameSource | null {
  for (const extension of SITE_GLYPH_SOURCE_EXTENSIONS) {
    const source = path.resolve(root, SITE_GLYPH_SOURCE_DIRECTORY, `${name}${extension}`);

    if (existsSync(source)) {
      return {
        grid,
        output: path.resolve(root, SITE_GLYPH_PUBLIC_DIRECTORY, `${name}.frames`),
        source,
      };
    }
  }

  return null;
}

function resolveSiteGlyphFrameSources(
  root: string,
  grid: GlyphRasterFrameGrid,
): GlyphFrameSource[] {
  return getSiteGlyphFrameNames(root).flatMap((name): GlyphFrameSource[] => {
    const source = resolveSiteGlyphFrameSource(root, name, grid);

    return source === null ? [] : [source];
  });
}

function frameGreyscaleSamplerPlugin(
  options: GlyphRasterFrameOptions,
  ensureGeneratedGlyphFrames: () => Promise<ReadonlyMap<string, string>> = () =>
    Promise.resolve(new Map()),
): Plugin {
  let config: ResolvedConfig | null = null;
  let glyphFramesBuild: Promise<void> | null = null;
  const generatedGlyphFramePaths = new Map<string, string>();

  const getPublicPath = (file: string): string => {
    if (!config) {
      throw new Error("Vite config was not resolved before resolving a glyph frame path.");
    }

    const publicDirectory = path.resolve(config.root, SITE_GLYPH_PUBLIC_DIRECTORY);
    const relativePath = path.relative(publicDirectory, file);

    if (relativePath.startsWith("..")) {
      throw new Error(`Glyph frame output '${file}' is outside the public directory.`);
    }

    return `/${relativePath.split(path.sep).join("/")}`;
  };

  const ensureGlyphFrames = (): Promise<void> => {
    if (!config) {
      throw new Error("Vite config was not resolved before generating glyph frames.");
    }

    if (glyphFramesBuild === null) {
      const resolvedConfig = config;
      glyphFramesBuild = (async (): Promise<void> => {
        generatedGlyphFramePaths.clear();

        for (const [logicalPath, generatedPath] of await ensureGeneratedGlyphFrames()) {
          generatedGlyphFramePaths.set(logicalPath, generatedPath);
        }
        for (const source of resolveSiteGlyphFrameSources(
          resolvedConfig.root,
          options.grids.viewport,
        )) {
          const output = await generateGreyscaleFrameSource(source, options);
          generatedGlyphFramePaths.set(getPublicPath(source.output), getPublicPath(output));
        }
      })();
    }

    return glyphFramesBuild;
  };

  return {
    async buildStart(): Promise<void> {
      await ensureGlyphFrames();
    },
    configResolved(resolvedConfig): void {
      config = resolvedConfig;
    },
    enforce: "pre",
    async load(id): Promise<string | null> {
      if (id !== RESOLVED_GLYPH_FRAME_POSTERS_MODULE_ID) {
        return null;
      }
      if (!config) {
        throw new Error("Vite config was not resolved before loading glyph frame posters.");
      }
      await ensureGlyphFrames();

      return `export default ${JSON.stringify(createGlyphFramePostersManifest(config.root, options))};`;
    },
    name: "glyph-frames",
    resolveId(id): string | null {
      return id === GLYPH_FRAME_POSTERS_MODULE_ID ? RESOLVED_GLYPH_FRAME_POSTERS_MODULE_ID : null;
    },
    async transform(source, id): Promise<string | null> {
      const file = id.split("?", 1)[0] ?? id;
      if (!SITE_GLYPH_SOURCE_FILE_EXTENSIONS.has(path.extname(file))) {
        return null;
      }

      await ensureGlyphFrames();

      let transformed = source;
      for (const [logicalPath, generatedPath] of generatedGlyphFramePaths) {
        transformed = transformed.replaceAll(logicalPath, generatedPath);
      }

      return transformed === source ? null : transformed;
    },
  };
}

export { frameGreyscaleSamplerPlugin, generateGreyscaleFrameSource };
export type { GlyphFrameSource };
