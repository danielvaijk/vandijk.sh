import { type QwikJSX, component$, useStylesScoped$ } from "@builder.io/qwik";
import articles from "virtual:articles";

import { ArticleSummaryList } from "src/components/article-summary-list";
import { CenteredTitle } from "src/components/centered-title";
import styles from "src/routes/blog/index.css?inline";

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  if (articles.length === 0) {
    return <CenteredTitle title="Oh!" subtitle="There's nothing here yet." />;
  }

  return (
    <div class="blog-index">
      <ArticleSummaryList articles={articles} />
    </div>
  );
});
