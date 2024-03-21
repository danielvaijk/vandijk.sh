import { component$, useStylesScoped$ } from "@builder.io/qwik";

import { ArticleSummaryList } from "~/components/articles/article-summary-list";
import { CenteredTitle } from "~/components/centered-title";

import styles from "./index.css?inline";
import articles from "../../media/articles.json";

export default component$(() => {
  useStylesScoped$(styles);

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
