import path from "path";
import { readFile, readdir } from "fs/promises";

import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

import type { ArticleSummaryProps } from "~/components/articles/article-summary-item";
import { ArticleSummaryList } from "~/components/articles/article-summary-list";
import { CenteredTitle } from "~/components/centered-title";

import styles from "./index.css?inline";

export const useArticleSummaries = routeLoader$(async (): Promise<Array<ArticleSummaryProps>> => {
  const articlesPath = "./src/routes/articles";
  const entities = await readdir(articlesPath, { withFileTypes: true });

  const results = [];

  for (const entity of entities) {
    if (!entity.isDirectory()) {
      continue;
    }

    const metadataFilePath = path.join(articlesPath, entity.name, "meta.json");
    const metadataContents = await readFile(metadataFilePath, { encoding: "utf-8" });

    results.push(JSON.parse(metadataContents));
  }

  return results.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);

    return dateB.getTime() - dateA.getTime();
  });
});

export default component$(() => {
  useStylesScoped$(styles);

  const { value: articles } = useArticleSummaries();

  if (!articles.length) {
    return <CenteredTitle title="Oh!" subtitle="There's nothing here yet." />;
  }

  return (
    <>
      <h1>Articles</h1>
      <ArticleSummaryList articles={articles} />
    </>
  );
});
