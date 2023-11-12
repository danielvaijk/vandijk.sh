import { readdir } from "fs/promises";
import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import type { ArticleSummaryProps } from "~/components/articles/article-summary-item";
import { ArticleSummaryList } from "~/components/articles/article-summary-list";

import styles from "./index.css?inline";
import { extractMetadataFromMdxFile } from "~/helpers/parser";

export const useArticleSummaries = routeLoader$(async (): Promise<Array<ArticleSummaryProps>> => {
  const articlesPath = "./src/routes/articles";
  const entities = await readdir(articlesPath, { withFileTypes: true });

  const results = [];

  for (const entity of entities) {
    if (!entity.isDirectory()) {
      continue;
    }

    results.push(await extractMetadataFromMdxFile(articlesPath, entity.name));
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

  return (
    <>
      <h1>Articles</h1>
      <ArticleSummaryList articles={articles} />
    </>
  );
});
