import path from "path";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";

import sharp, { type Sharp } from "sharp";

interface ParsedImage {
  width?: number;
  height?: number;
  format?: string;
  data: Buffer | string;
}

interface ProcessedImage {
  image: Sharp;
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
  const arrayBuffer = await blob.arrayBuffer();
  const image = sharp(arrayBuffer);

  return { image, blob };
}

async function createImageVariants({ image, blob }: ProcessedImage): Promise<Array<ParsedImage>> {
  const metadata = await image.metadata();
  const isSvg = metadata.format === "svg";

  if (!isSvg) {
    image = image.webp({
      effort: 6,
      quality: 80,
      alphaQuality: 100,
      smartSubsample: true,
      nearLossless: true,
    });
  }

  const variants = [];
  const { width = 0, height = 0 } = metadata;

  for (const resizeWidth of [480, 768, 1024, 1920]) {
    if (isSvg) {
      variants.push({
        width,
        height,
        format: metadata.format,
        data: await blob.text(),
      });

      break;
    }

    // The resize method mutates the image object reference, so we need
    // to call resize with the original width again at one point.
    const targetWidth = resizeWidth < width ? resizeWidth : width;
    const resizedImage = image.resize(targetWidth);

    const { data, info } = await resizedImage.toBuffer({
      resolveWithObject: true,
    });

    variants.push({
      format: info.format,
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

export { fetchAndProcessImage, createImageVariants, saveImageInPublicDirectory };
