import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

import prettierConfig from "@danielvaijk/prettier-config";
import prettier from "prettier";

import { joinPathNames } from "src/utilities/url";

interface ArticleMetadata {
  [index: string]: unknown;
  date: string;
}

const ARTICLE_METADATA_DIRECTORY = "./src/media";
const ARTICLES_METADATA_FILE_PATH = `${ARTICLE_METADATA_DIRECTORY}/articles.json`;
const ARTICLES_DIRECTORY = "./src/routes/blog";

const entities = readdirSync(ARTICLES_DIRECTORY, { withFileTypes: true });

const results = [];

for (const entity of entities) {
  if (!entity.isDirectory()) {
    continue;
  }

  const metadataFilePath = joinPathNames(ARTICLES_DIRECTORY, entity.name, "meta.json");
  const metadataContents = readFileSync(metadataFilePath, { encoding: "utf-8" });

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

if (!existsSync(ARTICLE_METADATA_DIRECTORY)) {
  mkdirSync(ARTICLE_METADATA_DIRECTORY);
}

writeFileSync(ARTICLES_METADATA_FILE_PATH, formattedResults);
