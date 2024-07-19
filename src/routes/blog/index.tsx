import { component$ } from "@builder.io/qwik";

import { ArticleSummaryList } from "~/components/articles/article-summary-list";
import { CenteredTitle } from "~/components/centered-title";

import articles from "../../media/articles.json";

export default component$(() => {
  if (!articles.length) {
    return <CenteredTitle title="Oh!" subtitle="There's nothing here yet." />;
  }

  return (
    <>
      <h2>Published Articles</h2>
      <ArticleSummaryList articles={articles} />
    </>
  );
});
