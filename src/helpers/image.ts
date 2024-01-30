import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import sharp, { type Sharp } from "sharp";

import { joinPathNames } from "~/utilities/url";

enum ImageFormat {
  WEBP = "webp",
  AVIF = "avif",
  GIF = "gif",
  SVG = "svg",
  PNG = "png",
  JPEG = "jpeg",
}

enum ImagePurpose {
  ARTICLE_COVER = 1,
  OTHER = 2,
}

interface ImageMetadata {
  format: string;
  width: number;
  height: number;
}

interface ProcessedImage {
  image: Sharp;
  metadata: ImageMetadata;
  willUseOriginal?: boolean;
  output: string | Buffer;
}

interface ImageSourceSet {
  path: string;
  size: string;
}

const IS_CF_BUILD = Boolean(process.env.CF_PAGES);

async function fetchAndProcessImage(
  url: string,
  purpose = ImagePurpose.OTHER
): Promise<ProcessedImage> {
  // Enforce consistency where we expect images to be uploaded directly to Notion's
  // S3 bucket. This ensures that the image files don't change or get deleted after
  // it's initially downloaded during a build (or referenced for an article).
  if (!url.startsWith("https://prod-files-secure.s3.us-west-2.amazonaws.com")) {
    throw new Error("Only images from Notion's S3 bucket can be loaded.");
  }

  console.debug(`Sending GET request to ${url}`);

  const response = await fetch(url);
  const blob = await response.blob();
  const image = sharp(await blob.arrayBuffer());
  const { format = "unknown", width = 0, height = 0 } = await image.metadata();
  const metadata = { format, width, height };

  if (ImagePurpose.ARTICLE_COVER === purpose) {
    switch (format) {
      case ImageFormat.JPEG:
      case ImageFormat.PNG:
        break;

      default:
        throw new Error("Cover images must be either in JPEG or PNG format.");
    }
  }

  let output;
  let willUseOriginal;

  switch (format) {
    case ImageFormat.SVG:
      willUseOriginal = true;
      output = await blob.text();
      break;

    case ImageFormat.GIF:
      willUseOriginal = true;
      output = Buffer.from(await blob.arrayBuffer());
      break;

    default:
      willUseOriginal = false;
      output = Buffer.from(await blob.arrayBuffer());
      break;
  }

  return { image, metadata, output, willUseOriginal };
}

async function createImageVariants(
  { image: original, metadata }: ProcessedImage,
  format: ImageFormat
): Promise<Array<ProcessedImage>> {
  let image = original.clone();

  switch (format) {
    case ImageFormat.WEBP:
      image = image.webp({
        effort: IS_CF_BUILD ? 6 : 0,
        quality: 80,
        alphaQuality: 100,
        smartSubsample: true,
        nearLossless: true,
      });
      break;

    case ImageFormat.AVIF:
      image = image.avif({
        effort: IS_CF_BUILD ? 9 : 0,
        quality: 80,
        lossless: false,
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
      `Resizing image from format ${metadata.format} to ${format} with width ${targetWidth}...`
    );

    const { data, info } = await resizedImage.toBuffer({
      resolveWithObject: true,
    });

    const newMetadata = {
      format,
      width: info.width,
      height: info.height,
    };

    variants.push({
      image,
      metadata: newMetadata,
      output: data,
    });

    if (targetWidth === width) {
      break;
    }
  }

  return variants;
}

async function createSourceSetFromImageVariants(
  variants: Array<ProcessedImage>
): Promise<Array<ImageSourceSet>> {
  const imageSources = [];

  for (let index = 0; index < variants.length; index++) {
    const variant = variants[index];
    const variantSize = `${variant.metadata.width}w`;
    const variantPath = await saveImage(variant);

    imageSources.push({ size: variantSize, path: variantPath });
  }

  return imageSources;
}

function serializeSourceSet(sourceSet: Array<ImageSourceSet>): string {
  return sourceSet.map(({ path, size }) => [path, size].join(" ")).join(", ");
}

async function saveImage({ metadata, output }: ProcessedImage): Promise<string> {
  const { format, width } = metadata;
  const contentHash = createHash("sha256").update(output).digest("hex");

  const fileName = `${contentHash}-${width}.${format}`;
  const publicPath = `/assets/${fileName}`;

  await writeFile(joinPathNames("./public", publicPath), output);

  return publicPath;
}

export {
  ImageFormat,
  ImagePurpose,
  fetchAndProcessImage,
  createImageVariants,
  createSourceSetFromImageVariants,
  serializeSourceSet,
  saveImage,
};
export type { ProcessedImage, ImageSourceSet };
