// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import styles from "src/components/articles/article-summary-item.scss?inline";
import { formatDateAsString } from "src/utilities/time";

export interface ArticleSummaryProps {
  coverImageMarkup: string;
  date: string;
  description: string;
  path: string;
  readTime: number;
  title: string;
  topic: string;
}

export const ArticleSummaryItem = component$<ArticleSummaryProps>(
  ({ coverImageMarkup, date, description, path, readTime, title, topic }): QwikJSX.Element => {
    const { scopeId } = useStylesScoped$(styles);

    const dateParsed = new Date(date);
    const dateFormatted = formatDateAsString(dateParsed);

    // Qwik will not automatically add the scoped styles to injected HTML,
    // so as a workaround we manually insert it as a class name to any
    // figure, picture, and img HTML elements in the markup string.
    const coverImageWithScopeId = coverImageMarkup.replace(
      /<(?<tag>figure|picture|img)(?<attributes>[^>]*)>/gu,
      (_, tag: string, attributes: string): string => `<${tag}${attributes} class="${scopeId}">`
    );

    return (
      <li class="article-summary">
        <Link class={scopeId} href={`/blog/${path}/`} prefetch>
          <div
            class="article-summary-cover-image"
            dangerouslySetInnerHTML={coverImageWithScopeId}
          ></div>

          <div class="article-summary-content">
            <time dateTime={dateParsed.toISOString()}>{dateFormatted}</time>
            <h4>{title}</h4>

            <p>{description}</p>

            <div class="article-summary-content-read-info">
              <p>Talks about {topic}</p>
              <p>~{readTime} min read</p>
            </div>
          </div>
        </Link>
      </li>
    );
  }
);
