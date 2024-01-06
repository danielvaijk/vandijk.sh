import path from "path";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";

import sharp from "sharp";

interface ParsedImage {
  width?: number;
  height?: number;
  format?: string;
  data: Buffer | string;
}

async function fetchAndParseImage(url: string): Promise<ParsedImage> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  let image = sharp(arrayBuffer);

  const isSvg = blob.type.startsWith("image/svg");
  const metadata = await image.metadata();

  if (!isSvg) {
    image = image.webp({
      effort: 6,
      quality: 80,
      alphaQuality: 100,
      smartSubsample: true,
      nearLossless: true,
    });
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format: isSvg ? metadata.format : "webp",
    data: isSvg ? await blob.text() : await image.toBuffer(),
  };
}

async function saveImageInPublicDirectory({ format, data }: ParsedImage): Promise<string> {
  const contentHash = createHash("sha256").update(data).digest("hex");

  const fileName = `${contentHash}.${format}`;
  const publicPath = `/assets/${fileName}`;

  await writeFile(path.join("./public", publicPath), data);

  return publicPath;
}

export { fetchAndParseImage, saveImageInPublicDirectory };
