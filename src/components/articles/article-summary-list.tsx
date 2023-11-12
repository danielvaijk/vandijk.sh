import { component$, useStylesScoped$ } from "@builder.io/qwik";
import {
  ArticleSummaryItem,
  type ArticleSummaryProps,
} from "~/components/articles/article-summary-item";

import styles from "./article-summary-list.css?inline";

interface ArticleSummaryListProps {
  articles: Array<ArticleSummaryProps>;
}

export const ArticleSummaryList = component$<ArticleSummaryListProps>(
  ({ articles }) => {
    useStylesScoped$(styles);

    return (
      <ul class="article-summary-list">
        {articles.map(({ title, date, path, description }) => (
          <ArticleSummaryItem
            key={title}
            title={title}
            date={date}
            path={path}
            description={description}
          />
        ))}
      </ul>
    );
  }
);
