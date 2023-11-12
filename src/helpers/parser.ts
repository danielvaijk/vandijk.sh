import { readFile } from "fs/promises";
import path from "path";

import type { ArticleSummaryProps } from "~/components/articles/article-summary-item";

async function extractMetadataFromMdxFile(
  basePath: string,
  fileName: string
): Promise<ArticleSummaryProps> {
  const filePath = path.join(basePath, fileName, "index.mdx");
  const fileData = await readFile(filePath, { encoding: "utf-8" });

  const [, metaBlock] = fileData.split("---", 2);
  const fields = metaBlock.split("\n").slice(1, -1);

  const result: Record<string, string> = {};

  for (const field of fields) {
    const [key, ...values] = field.split(":");
    result[key.trim()] = values.join(":").trim();
  }

  return {
    ...result,
    path: fileName,
  } as ArticleSummaryProps;
}

export { extractMetadataFromMdxFile };
