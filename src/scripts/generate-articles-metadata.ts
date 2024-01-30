import { readFile, readdir, writeFile } from "node:fs/promises";

import prettier from "prettier";

import { PRETTIER_CONFIG } from "~/definition/prettier";
import { joinPathNames } from "~/utilities/url";

const ARTICLES_METADATA_FILE_PATH = "./src/media/articles.json";
const ARTICLES_DIRECTORY = "./src/routes/articles";

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

const sortedResults = results.sort((a, b) => {
  const dateA = new Date(a.date);
  const dateB = new Date(b.date);

  return dateB.getTime() - dateA.getTime();
});

const serializedResults = JSON.stringify(sortedResults);
const formattedResults = await prettier.format(serializedResults, {
  parser: "json",
  ...PRETTIER_CONFIG,
});

await writeFile(ARTICLES_METADATA_FILE_PATH, formattedResults);
