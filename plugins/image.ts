import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, parse, resolve } from "node:path";

import sharp, { type Sharp } from "sharp";
import type { Plugin, ResolvedConfig } from "vite";

import { joinPathNames } from "../src/utilities/url";

enum ImageFormat {
  AVIF = "avif",
  GIF = "gif",
  JPEG = "jpeg",
  PNG = "png",
  SVG = "svg",
  WEBP = "webp",
}

enum ImagePurpose {
  ARTICLE_COVER = 1,
  OTHER = 2,
}

interface ImageMetadata {
  format: string;
  height: number;
  width: number;
}

interface ProcessedImage {
  image: Sharp;
  metadata: ImageMetadata;
  output: string | Buffer;
  willUseOriginal: boolean;
}

interface ImageSourceSet {
  path: string;
  size: string;
}

interface ArticleImageManifestEntry {
  defaultSource: string;
  height: number;
  markup: (alt: string, isPriority?: boolean) => string;
  type: string;
  width: number;
}

const ARTICLES_DIRECTORY = "src/routes/blog";
const ARTICLE_PUBLIC_ASSETS_DIRECTORY = "public/blog";
const ARTICLE_SOURCE_ASSETS_DIRECTORY_NAME = "assets";
const ARTICLE_IMAGE_EXTENSIONS = new Set([".avif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const ARTICLE_GENERATED_ONLY_EXTENSIONS = new Set([".gif"]);
const ARTICLE_MARKDOWN_IMAGE_REGEX =
  /!\[(?<alt>[^\]]*)\]\((?<src>\/blog\/[^)\s]+\.(?:avif|jpe?g|png|svg|webp))\)/giu;
const ARTICLE_COVER_SOURCE_REGEX =
  /(<ArticleCover\b[\s\S]*?\bsrc=")(?<src>\/blog\/[^"]+\.(?:avif|jpe?g|png|svg|webp))("[\s\S]*?\/>)/giu;
const IS_CF_BUILD = Boolean(process.env.CF_PAGES);

const MIN_EFFORT_WEBP = 0;
const MAX_EFFORT_WEBP = 6;

const MIN_EFFORT_AVIF = 0;
const MAX_EFFORT_AVIF = 9;
const articleImageManifest = new Map<string, ArticleImageManifestEntry>();
const articleImageBuilds = new Map<string, Promise<void>>();

function getArticleAssetsDirectory(root: string, path: string): string {
  return resolve(root, ARTICLES_DIRECTORY, path, ARTICLE_SOURCE_ASSETS_DIRECTORY_NAME);
}

function getArticlePublicAssetsDirectory(root: string, path: string): string {
  return resolve(root, ARTICLE_PUBLIC_ASSETS_DIRECTORY, path);
}

function getArticlePublicPath(path: string, fileName: string): string {
  return `/blog/${path}/${fileName}`;
}

function getArticleSourcePath(root: string, publicPath: string): string | null {
  const match = /^\/blog\/(?<path>[^/]+)\/(?<file>[^/]+)$/u.exec(publicPath);

  if (match?.groups === undefined) {
    return null;
  }

  return join(getArticleAssetsDirectory(root, match.groups.path), basename(match.groups.file));
}

function prepareArticlePublicAssets(root: string, path: string): void {
  const sourceDirectory = getArticleAssetsDirectory(root, path);
  const publicDirectory = getArticlePublicAssetsDirectory(root, path);

  rmSync(publicDirectory, { force: true, recursive: true });
  mkdirSync(publicDirectory, { recursive: true });

  if (!existsSync(sourceDirectory)) {
    return;
  }

  for (const entity of readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (!entity.isFile()) {
      continue;
    }

    const extension = extname(entity.name).toLowerCase();

    if (ARTICLE_GENERATED_ONLY_EXTENSIONS.has(extension)) {
      continue;
    }

    copyFileSync(join(sourceDirectory, entity.name), join(publicDirectory, entity.name));
  }
}

function readArticlePaths(root: string): Array<string> {
  const articlesDirectory = resolve(root, ARTICLES_DIRECTORY);

  if (!existsSync(articlesDirectory)) {
    return [];
  }

  return readdirSync(articlesDirectory, { withFileTypes: true }).flatMap(
    (entity): Array<string> => (entity.isDirectory() ? [entity.name] : []),
  );
}

function warnOnUnexpectedArticleCoverAspectRatio({ height, width }: ImageMetadata): void {
  if (width <= 0 || height <= 0) {
    console.warn("Cover image aspect ratio could not be checked because dimensions are missing.");
    return;
  }

  if (width * 9 !== height * 16) {
    console.warn(`Cover images should use a 16:9 aspect ratio. Received ${width}x${height}.`);
  }
}

async function fetchAndProcessImage(
  url: string,
  purpose = ImagePurpose.OTHER,
): Promise<ProcessedImage> {
  console.debug(`Sending GET request to ${url}`);

  const response = await fetch(url);
  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  return processImage(buffer, purpose);
}

async function readAndProcessImage(
  path: string,
  purpose = ImagePurpose.OTHER,
): Promise<ProcessedImage> {
  return processImage(await readFile(path), purpose);
}

async function processImage(input: Buffer, purpose = ImagePurpose.OTHER): Promise<ProcessedImage> {
  const image = sharp(input);
  const { format = "unknown", height = 0, width = 0 } = await image.metadata();
  const metadata = { format, height, width };

  if (ImagePurpose.ARTICLE_COVER === purpose) {
    switch (format) {
      case ImageFormat.JPEG:
      case ImageFormat.PNG:
        break;

      default:
        throw new Error("Cover images must be either in JPEG or PNG format.");
    }

    warnOnUnexpectedArticleCoverAspectRatio(metadata);
  }

  let output = null;
  let willUseOriginal = false;

  switch (format) {
    case ImageFormat.SVG:
      willUseOriginal = true;
      output = input.toString("utf-8");
      break;

    case ImageFormat.GIF:
      willUseOriginal = true;
      output = input;
      break;

    default:
      willUseOriginal = false;
      output = input;
      break;
  }

  return { image, metadata, output, willUseOriginal };
}

async function createImageVariants(
  { image: original, metadata }: ProcessedImage,
  format: ImageFormat,
): Promise<Array<ProcessedImage>> {
  let image = original.clone();

  switch (format) {
    case ImageFormat.WEBP:
      image = image.webp({
        alphaQuality: 100,
        effort: IS_CF_BUILD ? MAX_EFFORT_WEBP : MIN_EFFORT_WEBP,
        nearLossless: true,
        quality: 80,
        smartSubsample: true,
      });
      break;

    case ImageFormat.AVIF:
      image = image.avif({
        effort: IS_CF_BUILD ? MAX_EFFORT_AVIF : MIN_EFFORT_AVIF,
        lossless: false,
        quality: 80,
      });
      break;

    default:
      throw new Error(`Image format '${format}' is not supported.`);
  }

  const variants: Array<ProcessedImage> = [];
  const { width = 0 } = metadata;

  for (const resizeWidth of [480, 705, 960, 1410, 1440, 2115]) {
    const targetWidth = resizeWidth < width ? resizeWidth : width;
    const resizedImage = image.resize(targetWidth);

    console.debug(
      `Resizing image from format ${metadata.format} to ${format} with width ${targetWidth}...`,
    );

    const { data, info } = await resizedImage.toBuffer({
      resolveWithObject: true,
    });

    const newMetadata = {
      format,
      height: info.height,
      width: info.width,
    };

    variants.push({
      image,
      metadata: newMetadata,
      output: data,
      willUseOriginal: false,
    });

    if (targetWidth === width) {
      break;
    }
  }

  return variants;
}

async function saveImage({ metadata, output }: ProcessedImage): Promise<string> {
  const { format, width } = metadata;
  const contentHash = createHash("sha256").update(output).digest("hex");

  const fileName = `${contentHash}-${width}.${format}`;
  const publicPath = `/assets/${fileName}`;

  await writeFile(joinPathNames("./public", publicPath), output);

  return publicPath;
}

async function createSourceSetFromImageVariants(
  variants: Array<ProcessedImage>,
): Promise<Array<ImageSourceSet>> {
  const imageSources = [];

  for (const variant of variants) {
    const variantSize = `${variant.metadata.width}w`;
    const variantPath = await saveImage(variant);

    imageSources.push({ path: variantPath, size: variantSize });
  }

  return imageSources;
}

function serializeSourceSet(sourceSet: Array<ImageSourceSet>): string {
  return sourceSet.map(({ path, size }): string => [path, size].join(" ")).join(", ");
}

function renderImageMarkup({
  alt,
  avifSourceSet: avifSources = [],
  height,
  isPriority = false,
  publicPath,
  webpSourceSet: webpSources = [],
  width,
}: {
  alt: string;
  avifSourceSet?: Array<ImageSourceSet>;
  height: number;
  isPriority?: boolean;
  publicPath: string;
  webpSourceSet?: Array<ImageSourceSet>;
  width: number;
}): string {
  const src = `src="${publicPath}"`;
  const widthAttribute = `width="${width}"`;
  const heightAttribute = `height="${height}"`;
  const decoding = `decoding="${isPriority ? "sync" : "async"}"`;
  const loading = `loading="${isPriority ? "eager" : "lazy"}"`;
  const altAttribute = `alt="${alt}"`;
  const img = `<img ${src} ${widthAttribute} ${heightAttribute} ${altAttribute} ${decoding} ${loading} />`;

  if (avifSources.length + webpSources.length === 0) {
    return ["<figure>", img, "</figure>"].join("\n");
  }

  const sizes = `sizes="(max-width: 46rem) 90vw, 46rem"`;
  const avifSourceSet = `srcset="${serializeSourceSet(avifSources)}"`;
  const webpSourceSet = `srcset="${serializeSourceSet(webpSources)}"`;

  return [
    "<figure>",
    "<picture>",
    `<source type="image/avif" ${sizes} ${avifSourceSet} />`,
    `<source type="image/webp" ${sizes} ${webpSourceSet} />`,
    img,
    "</picture>",
    "</figure>",
  ].join("\n");
}

async function processArticleImage(root: string, publicPath: string): Promise<void> {
  const sourcePath = getArticleSourcePath(root, publicPath);

  if (sourcePath === null || !existsSync(sourcePath)) {
    return;
  }

  const image = await readAndProcessImage(sourcePath);
  const { format, height, width } = image.metadata;

  if (image.willUseOriginal) {
    articleImageManifest.set(publicPath, {
      defaultSource: publicPath,
      height,
      markup: (alt, isPriority = false): string =>
        renderImageMarkup({ alt, height, isPriority, publicPath, width }),
      type: format,
      width,
    });
    return;
  }

  const avifVariants = await createImageVariants(image, ImageFormat.AVIF);
  const webpVariants = await createImageVariants(image, ImageFormat.WEBP);
  const avifSourceSet = await createSourceSetFromImageVariants(avifVariants);
  const webpSourceSet = await createSourceSetFromImageVariants(webpVariants);
  const defaultSource = webpSourceSet[0]?.path ?? publicPath;

  articleImageManifest.set(publicPath, {
    defaultSource,
    height,
    markup: (alt, isPriority = false): string =>
      renderImageMarkup({
        alt,
        avifSourceSet,
        height,
        isPriority,
        publicPath: defaultSource,
        webpSourceSet,
        width,
      }),
    type: format,
    width,
  });
}

async function processArticleImages(root: string): Promise<void> {
  articleImageManifest.clear();

  for (const articlePath of readArticlePaths(root)) {
    const sourceDirectory = getArticleAssetsDirectory(root, articlePath);

    prepareArticlePublicAssets(root, articlePath);

    if (!existsSync(sourceDirectory)) {
      continue;
    }

    for (const entity of readdirSync(sourceDirectory, { withFileTypes: true })) {
      const extension = parse(entity.name).ext.toLowerCase();

      if (!entity.isFile() || !ARTICLE_IMAGE_EXTENSIONS.has(extension)) {
        continue;
      }

      await processArticleImage(root, getArticlePublicPath(articlePath, entity.name));
    }
  }
}

function ensureArticleImages(root: string): Promise<void> {
  const existingBuild = articleImageBuilds.get(root);

  if (existingBuild !== undefined) {
    return existingBuild;
  }

  const build = processArticleImages(root);
  articleImageBuilds.set(root, build);

  return build;
}

function getArticleImageMarkup(publicPath: string, alt: string, isPriority = false): string | null {
  return articleImageManifest.get(publicPath)?.markup(alt, isPriority) ?? null;
}

function getArticleImageDefaultSource(publicPath: string): string | null {
  return articleImageManifest.get(publicPath)?.defaultSource ?? null;
}

function imagePlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "image",
    enforce: "pre",
    configResolved(resolvedConfig): void {
      config = resolvedConfig;
    },
    async buildStart(): Promise<void> {
      await ensureArticleImages(config.root);
    },
    transform(source, id): string | null {
      if (!/\/src\/routes\/blog\/[^/]+\/index\.mdx(?:\?|$)/u.test(id)) {
        return null;
      }

      return source
        .replace(
          ARTICLE_MARKDOWN_IMAGE_REGEX,
          (
            match: string,
            _alt: string,
            _src: string,
            _offset: number,
            _input: string,
            groups?: {
              alt?: string;
              src?: string;
            },
          ): string => {
            if (groups?.src === undefined || groups.alt === undefined) {
              return match;
            }

            return getArticleImageMarkup(groups.src, groups.alt) ?? match;
          },
        )
        .replace(
          ARTICLE_COVER_SOURCE_REGEX,
          (
            match: string,
            prefix: string,
            _src: string,
            suffix: string,
            _offset: number,
            _input: string,
            groups?: {
              src?: string;
            },
          ): string => {
            const defaultSource =
              groups?.src === undefined ? null : getArticleImageDefaultSource(groups.src);

            return defaultSource === null ? match : `${prefix}${defaultSource}${suffix}`;
          },
        );
    },
  };
}

export {
  ImageFormat,
  ImagePurpose,
  fetchAndProcessImage,
  readAndProcessImage,
  createImageVariants,
  createSourceSetFromImageVariants,
  ensureArticleImages,
  getArticleImageDefaultSource,
  getArticleImageMarkup,
  imagePlugin,
  serializeSourceSet,
  saveImage,
};
export type { ProcessedImage, ImageSourceSet };
