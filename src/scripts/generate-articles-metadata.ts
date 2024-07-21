import { readFile, readdir, writeFile } from "node:fs/promises";

import prettierConfig from "@danielvaijk/prettier-config";
import prettier from "prettier";

import { joinPathNames } from "src/utilities/url";

interface ArticleMetadata {
  [index: string]: unknown;
  date: string;
}

const ARTICLES_METADATA_FILE_PATH = "./src/media/articles.json";
const ARTICLES_DIRECTORY = "./src/routes/blog";

const entities = await readdir(ARTICLES_DIRECTORY, { withFileTypes: true });

const results = [];

for (const entity of entities) {
  if (!entity.isDirectory()) {
    continue;
  }

  const metadataFilePath = joinPathNames(ARTICLES_DIRECTORY, entity.name, "meta.json");
  const metadataContents = await readFile(metadataFilePath, { encoding: "utf-8" });

  results.push(JSON.parse(metadataContents));
}

const sortedResults = results.sort((a: ArticleMetadata, b: ArticleMetadata): number => {
  const dateA = new Date(a.date);
  const dateB = new Date(b.date);

  return dateB.getTime() - dateA.getTime();
});

const serializedResults = JSON.stringify(sortedResults);
const formattedResults = await prettier.format(serializedResults, {
  parser: "json",
  ...prettierConfig,
});

await writeFile(ARTICLES_METADATA_FILE_PATH, formattedResults);
