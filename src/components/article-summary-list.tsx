import { type QwikJSX, component$, useStylesScoped$ } from "@builder.io/qwik";

import { ArticleSummaryItem, type ArticleSummaryProps } from "src/components/article-summary-item";
import styles from "src/components/article-summary-list.css?inline";

interface ArticleSummaryListProps {
  articles: ArticleSummaryProps[];
}

export const ArticleSummaryList = component$<ArticleSummaryListProps>(
  ({ articles }): QwikJSX.Element => {
    useStylesScoped$(styles);

    return (
      <ul class="article-summary-list">
        {articles.map(
          ({
            coverImageFramesPath,
            coverImageMarkup,
            date,
            description,
            path,
            readTime,
            title,
            topic,
          }): QwikJSX.Element => (
            <ArticleSummaryItem
              key={path}
              coverImageFramesPath={coverImageFramesPath}
              coverImageMarkup={coverImageMarkup}
              date={date}
              description={description}
              path={path}
              readTime={readTime}
              title={title}
              topic={topic}
            />
          ),
        )}
      </ul>
    );
  },
);
