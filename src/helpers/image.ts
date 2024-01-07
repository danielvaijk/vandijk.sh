import path from "path";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";

import sharp, { type Sharp } from "sharp";

enum ImageFormat {
  WEBP = "webp",
  AVIF = "avif",
  GIF = "gif",
  SVG = "svg",
}

interface ParsedImage {
  width?: number;
  height?: number;
  format?: string;
  data: Buffer | string;
}

interface ProcessedImage {
  image: Sharp;
  metadata: sharp.Metadata;
  blob: Blob;
}

async function fetchAndProcessImage(url: string): Promise<ProcessedImage> {
  // Enforce consistency where we expect images to be uploaded directly to Notion's
  // S3 bucket. This ensures that the image files don't change or get deleted after
  // it's initially downloaded during a build (or referenced for an article).
  if (!url.startsWith("https://prod-files-secure.s3.us-west-2.amazonaws.com")) {
    throw new Error("Only images from Notion's S3 bucket can be loaded.");
  }

  const response = await fetch(url);
  const blob = await response.blob();
  const image = sharp(await blob.arrayBuffer());
  const metadata = await image.metadata();

  return { image, metadata, blob };
}

async function createImageVariants(
  { image: original, metadata }: ProcessedImage,
  format: ImageFormat
): Promise<Array<ParsedImage>> {
  let image = original.clone();

  switch (format) {
    case ImageFormat.WEBP:
      image = image.webp({
        effort: 6,
        quality: 80,
        alphaQuality: 100,
        smartSubsample: true,
        nearLossless: true,
      });
      break;

    case ImageFormat.AVIF:
      image = image.avif({
        effort: 9,
        quality: 80,
        lossless: false,
      });
      break;

    default:
      throw new Error(`Image format '${format}' is not supported.`);
  }

  const variants = [];
  const { width = 0 } = metadata;

  for (const resizeWidth of [480, 768, 1024, 1920]) {
    // The resize method mutates the image object reference, so we need
    // to call resize with the original width again at one point.
    const targetWidth = resizeWidth < width ? resizeWidth : width;
    const resizedImage = image.resize(targetWidth);

    const { data, info } = await resizedImage.toBuffer({
      resolveWithObject: true,
    });

    variants.push({
      format,
      width: info.width,
      height: info.height,
      data,
    });

    if (targetWidth === width) {
      break;
    }
  }

  return variants;
}

async function saveImageInPublicDirectory({ format, width, data }: ParsedImage): Promise<string> {
  const contentHash = createHash("sha256").update(data).digest("hex");

  const fileName = `${contentHash}-${width}.${format}`;
  const publicPath = `/assets/${fileName}`;

  await writeFile(path.join("./public", publicPath), data);

  return publicPath;
}

export { ImageFormat, fetchAndProcessImage, createImageVariants, saveImageInPublicDirectory };
export type { ParsedImage };
