// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";

import {
  ArticleSummaryItem,
  type ArticleSummaryProps,
} from "src/components/articles/article-summary-item";
import styles from "src/components/articles/article-summary-list.scss?inline";

interface ArticleSummaryListProps {
  articles: Array<ArticleSummaryProps>;
}

export const ArticleSummaryList = component$<ArticleSummaryListProps>(
  ({ articles }): QwikJSX.Element => {
    useStylesScoped$(styles);

    return (
      <ul class="article-summary-list">
        {articles.map(
          ({ path, ...rest }): QwikJSX.Element => (
            <ArticleSummaryItem key={path} path={path} {...rest} />
          )
        )}
      </ul>
    );
  }
);
