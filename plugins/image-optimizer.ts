import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { env } from "node:process";

import sharp, { type Sharp } from "sharp";
import type { Plugin, ResolvedConfig } from "vite";

import { createAssetContentHash } from "./asset-content-hash";

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
  markup: (alt: string, isPriority?: boolean, includeFigure?: boolean) => string;
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
const ARTICLE_HTML_IMAGE_REGEX =
  /<img\b(?<attributes>[^>]*?\bsrc="(?<src>\/blog\/[^"]+\.(?:avif|jpe?g|png|svg|webp))"[^>]*?\balt="(?<alt>[^"]*)"[^>]*)\/?>/giu;
const IS_CF_BUILD = Boolean(env.CF_PAGES);

const MIN_EFFORT_WEBP = 0;
const MAX_EFFORT_WEBP = 6;

const MIN_EFFORT_AVIF = 0;
const MAX_EFFORT_AVIF = 9;
const articleImageManifest = new Map<string, ArticleImageManifestEntry>();
const articleImageBuilds = new Map<string, Promise<void>>();

function getArticleAssetsDirectory(root: string, articlePath: string): string {
  return path.resolve(root, ARTICLES_DIRECTORY, articlePath, ARTICLE_SOURCE_ASSETS_DIRECTORY_NAME);
}

function getArticlePublicAssetsDirectory(root: string, articlePath: string): string {
  return path.resolve(root, ARTICLE_PUBLIC_ASSETS_DIRECTORY, articlePath);
}

function getArticleSourcePath(root: string, publicPath: string): string | null {
  const match = /^\/blog\/(?<path>[^/]+)\/(?<file>[^/]+)$/u.exec(publicPath);

  if (!match || !match.groups) {
    return null;
  }

  return path.join(
    getArticleAssetsDirectory(root, match.groups.path),
    path.basename(match.groups.file),
  );
}

function prepareArticlePublicAssets(root: string, articlePath: string): void {
  const sourceDirectory = getArticleAssetsDirectory(root, articlePath);
  const publicDirectory = getArticlePublicAssetsDirectory(root, articlePath);

  rmSync(publicDirectory, { force: true, recursive: true });
  mkdirSync(publicDirectory, { recursive: true });

  if (!existsSync(sourceDirectory)) {
    return;
  }

  for (const entity of readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (!entity.isFile()) {
      continue;
    }

    const extension = path.extname(entity.name).toLowerCase();

    if (ARTICLE_GENERATED_ONLY_EXTENSIONS.has(extension)) {
      continue;
    }

    copyFileSync(path.join(sourceDirectory, entity.name), path.join(publicDirectory, entity.name));
  }
}

function readArticlePaths(root: string): string[] {
  const articlesDirectory = path.resolve(root, ARTICLES_DIRECTORY);

  if (!existsSync(articlesDirectory)) {
    return [];
  }

  return readdirSync(articlesDirectory, { withFileTypes: true }).flatMap((entity): string[] =>
    entity.isDirectory() ? [entity.name] : [],
  );
}

function readArticleImagePublicPaths(root: string, articlePath: string): string[] {
  const filePath = path.resolve(root, ARTICLES_DIRECTORY, articlePath, "index.mdx");

  if (!existsSync(filePath)) {
    return [];
  }

  const publicPaths = new Set<string>();
  const source = readFileSync(filePath, "utf8");

  for (const match of source.matchAll(ARTICLE_MARKDOWN_IMAGE_REGEX)) {
    const publicPath = match.groups ? match.groups.src : null;

    if (typeof publicPath === "string" && publicPath.startsWith(`/blog/${articlePath}/`)) {
      publicPaths.add(publicPath);
    }
  }

  for (const match of source.matchAll(ARTICLE_HTML_IMAGE_REGEX)) {
    const publicPath = match.groups ? match.groups.src : null;

    if (typeof publicPath === "string" && publicPath.startsWith(`/blog/${articlePath}/`)) {
      publicPaths.add(publicPath);
    }
  }

  return [...publicPaths];
}

function warnOnUnexpectedArticleCoverAspectRatio({ height, width }: ImageMetadata): void {
  if (width <= 0 || height <= 0) {
    return;
  }
}

async function fetchAndProcessImage(
  url: string,
  purpose = ImagePurpose.OTHER,
): Promise<ProcessedImage> {
  const response = await fetch(url);
  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  return processImage(buffer, purpose);
}

async function readAndProcessImage(
  sourcePath: string,
  purpose = ImagePurpose.OTHER,
): Promise<ProcessedImage> {
  return processImage(await readFile(sourcePath), purpose);
}

async function processImage(input: Buffer, purpose = ImagePurpose.OTHER): Promise<ProcessedImage> {
  const image = sharp(input);
  const { format = "unknown", height = 0, width = 0 } = await image.metadata();
  const metadata = { format, height, width };

  if (ImagePurpose.ARTICLE_COVER === purpose) {
    switch (format) {
      case ImageFormat.JPEG:
      case ImageFormat.PNG: {
        break;
      }

      default: {
        throw new Error("Cover images must be either in JPEG or PNG format.");
      }
    }

    warnOnUnexpectedArticleCoverAspectRatio(metadata);
  }

  let output: string | Buffer = input;
  let willUseOriginal = false;

  switch (format) {
    case ImageFormat.SVG: {
      willUseOriginal = true;
      output = input.toString("utf8");
      break;
    }

    case ImageFormat.GIF: {
      willUseOriginal = true;
      output = input;
      break;
    }

    default: {
      willUseOriginal = false;
      output = input;
      break;
    }
  }

  return { image, metadata, output, willUseOriginal };
}

async function createImageVariants(
  { image: original, metadata }: ProcessedImage,
  format: ImageFormat,
): Promise<ProcessedImage[]> {
  let image = original.clone();

  switch (format) {
    case ImageFormat.WEBP: {
      image = image.webp({
        alphaQuality: 100,
        effort: IS_CF_BUILD ? MAX_EFFORT_WEBP : MIN_EFFORT_WEBP,
        nearLossless: true,
        quality: 80,
        smartSubsample: true,
      });
      break;
    }

    case ImageFormat.AVIF: {
      image = image.avif({
        effort: IS_CF_BUILD ? MAX_EFFORT_AVIF : MIN_EFFORT_AVIF,
        lossless: false,
        quality: 80,
      });
      break;
    }

    default: {
      throw new Error(`Image format '${format}' is not supported.`);
    }
  }

  const variants: ProcessedImage[] = [];
  const { width = 0 } = metadata;

  for (const resizeWidth of [480, 705, 960, 1410, 1440, 2115]) {
    const targetWidth = resizeWidth < width ? resizeWidth : width;
    const resizedImage = image.resize(targetWidth);

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

async function saveImage(
  { metadata, output }: ProcessedImage,
  publicDirectory = "/",
): Promise<string> {
  const { format, width } = metadata;
  const contentHash = createAssetContentHash(output);

  const fileName = `${contentHash}-${width}.${format}`;
  const normalizedPublicDirectory = `/${publicDirectory.replaceAll(/^\/+|\/+$/gu, "")}`;
  const publicPath =
    normalizedPublicDirectory === "/" ? `/${fileName}` : `${normalizedPublicDirectory}/${fileName}`;

  await mkdir(path.join("public", normalizedPublicDirectory), { recursive: true });
  await writeFile(path.join("public", publicPath.replace(/^\//u, "")), output);

  return publicPath;
}

async function createSourceSetFromImageVariants(
  variants: ProcessedImage[],
  publicDirectory = "/",
): Promise<ImageSourceSet[]> {
  const imageSources = [];

  for (const variant of variants) {
    const variantSize = `${variant.metadata.width}w`;
    const variantPath = await saveImage(variant, publicDirectory);

    imageSources.push({ path: variantPath, size: variantSize });
  }

  return imageSources;
}

function serializeSourceSet(sourceSet: ImageSourceSet[]): string {
  return sourceSet
    .map(({ path: sourcePath, size }): string => [sourcePath, size].join(" "))
    .join(", ");
}

function renderImageMarkup({
  alt,
  avifSourceSet: avifSources = [],
  height,
  includeFigure = true,
  isPriority = false,
  publicPath,
  webpSourceSet: webpSources = [],
  width,
}: {
  alt: string;
  avifSourceSet?: ImageSourceSet[];
  height: number;
  includeFigure?: boolean;
  isPriority?: boolean;
  publicPath: string;
  webpSourceSet?: ImageSourceSet[];
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
    return includeFigure ? ["<figure>", img, "</figure>"].join("\n") : img;
  }

  const sizes = `sizes="(max-width: 46rem) 90vw, 46rem"`;
  const avifSourceSet = `srcset="${serializeSourceSet(avifSources)}"`;
  const webpSourceSet = `srcset="${serializeSourceSet(webpSources)}"`;

  const picture = [
    "<picture>",
    `<source type="image/avif" ${sizes} ${avifSourceSet} />`,
    `<source type="image/webp" ${sizes} ${webpSourceSet} />`,
    img,
    "</picture>",
  ].join("\n");

  return includeFigure ? ["<figure>", picture, "</figure>"].join("\n") : picture;
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
      markup: (alt, isPriority = false, includeFigure = true): string =>
        renderImageMarkup({ alt, height, includeFigure, isPriority, publicPath, width }),
      type: format,
      width,
    });
    return;
  }

  const avifVariants = await createImageVariants(image, ImageFormat.AVIF);
  const webpVariants = await createImageVariants(image, ImageFormat.WEBP);
  const variantPublicDirectory = path.posix.dirname(publicPath);
  const avifSourceSet = await createSourceSetFromImageVariants(
    avifVariants,
    variantPublicDirectory,
  );
  const webpSourceSet = await createSourceSetFromImageVariants(
    webpVariants,
    variantPublicDirectory,
  );
  const defaultSource = webpSourceSet.length > 0 ? webpSourceSet[0].path : publicPath;

  articleImageManifest.set(publicPath, {
    defaultSource,
    height,
    markup: (alt, isPriority = false, includeFigure = true): string =>
      renderImageMarkup({
        alt,
        avifSourceSet,
        height,
        includeFigure,
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
    prepareArticlePublicAssets(root, articlePath);

    for (const publicPath of readArticleImagePublicPaths(root, articlePath)) {
      const extension = path.extname(publicPath).toLowerCase();

      if (!ARTICLE_IMAGE_EXTENSIONS.has(extension)) {
        continue;
      }

      await processArticleImage(root, publicPath);
    }
  }
}

function ensureArticleImages(root: string): Promise<void> {
  const existingBuild = articleImageBuilds.get(root);

  if (existingBuild) {
    return existingBuild;
  }

  const build = processArticleImages(root);
  articleImageBuilds.set(root, build);

  return build;
}

function getArticleImageMarkup({
  publicPath,
  alt,
  isPriority = false,
  includeFigure = true,
}: {
  publicPath: string;
  alt: string;
  isPriority?: boolean;
  includeFigure?: boolean;
}): string | null {
  const entry = articleImageManifest.get(publicPath);
  return entry ? entry.markup(alt, isPriority, includeFigure) : null;
}

function imageOptimizerPlugin(): Plugin {
  let config: ResolvedConfig | null = null;

  return {
    async buildStart(): Promise<void> {
      if (!config) {
        throw new Error("Vite config was not resolved before build start.");
      }
      await ensureArticleImages(config.root);
    },
    configResolved(resolvedConfig): void {
      config = resolvedConfig;
    },
    enforce: "pre",
    name: "image",
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
            if (!groups || !groups.src || !groups.alt) {
              return match;
            }

            return getArticleImageMarkup({ alt: groups.alt, publicPath: groups.src }) ?? match;
          },
        )
        .replace(
          ARTICLE_HTML_IMAGE_REGEX,
          (
            match: string,
            _attributes: string,
            _src: string,
            _alt: string,
            _offset: number,
            _input: string,
            groups?: {
              alt?: string;
              src?: string;
            },
          ): string => {
            if (!groups || !groups.src || !groups.alt) {
              return match;
            }

            return (
              getArticleImageMarkup({
                alt: groups.alt,
                includeFigure: false,
                publicPath: groups.src,
              }) ?? match
            );
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
  getArticleImageMarkup,
  imageOptimizerPlugin,
  serializeSourceSet,
  saveImage,
};
export type { ProcessedImage, ImageSourceSet };
