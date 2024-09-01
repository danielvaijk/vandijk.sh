// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import sharp, { type Sharp } from "sharp";

import { joinPathNames } from "src/utilities/url";

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

const IS_CF_BUILD = Boolean(process.env.CF_PAGES);

const MIN_EFFORT_WEBP = 0;
const MAX_EFFORT_WEBP = 6;

const MIN_EFFORT_AVIF = 0;
const MAX_EFFORT_AVIF = 9;

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
  }

  let output = null;
  let willUseOriginal = false;

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

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Defined inline.
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
  variants: Array<ProcessedImage>
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
