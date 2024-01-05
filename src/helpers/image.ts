import path from "path";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";

import sharp from "sharp";

interface ParsedImage {
  width?: number;
  height?: number;
  format?: string;
  buffer: ArrayBuffer;
  text: string;
}

async function fetchAndParseImage(url: string): Promise<ParsedImage> {
  const response = await fetch(url);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const text = await blob.text();

  const image = await sharp(buffer).metadata();
  const { width, height, format } = image;

  return { width, height, format, buffer, text };
}

async function saveImageInPublicDirectory({ format, text, buffer }: ParsedImage): Promise<string> {
  const contentHash = createHash("sha256").update(text).digest("hex");

  const fileName = `${contentHash}.${format}`;
  const publicPath = `/assets/${fileName}`;
  const outputPath = path.join("./public", publicPath);

  if (format === "svg") {
    await writeFile(outputPath, text);
  } else {
    await writeFile(outputPath, Buffer.from(buffer));
  }

  return publicPath;
}

export { fetchAndParseImage, saveImageInPublicDirectory };
