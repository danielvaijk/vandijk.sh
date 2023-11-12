import path from "path";
import { readFile, readdir } from "fs/promises";
import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import type { ArticleSummaryProps } from "~/components/articles/article-summary-item";
import { ArticleSummaryList } from "~/components/articles/article-summary-list";

import styles from "./index.css?inline";

export const useArticleSummaries = routeLoader$(
  async (): Promise<Array<ArticleSummaryProps>> => {
    const articlesPath = "./src/routes/articles";
    const entities = await readdir(articlesPath, { withFileTypes: true });

    const results = [];

    for (const entity of entities) {
      if (!entity.isDirectory()) {
        continue;
      }

      const mdx = await readFile(
        path.join(articlesPath, entity.name, "index.mdx"),
        { encoding: "utf-8" }
      );

      const [, metaBlock] = mdx.split("---", 2);
      const [, date, title, description] = metaBlock.split("\n");

      const summary: Record<string, string> = {};

      for (const serializedValue of [date, title, description]) {
        const [key, ...values] = serializedValue.split(":");
        summary[key.trim()] = values.join(":").trim();
      }

      results.push({
        ...summary,
        path: entity.name,
      } as ArticleSummaryProps);
    }

    return results;
  }
);

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
