import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import styles from "./article-summary-item.css?inline";
import { formatDateAsString } from "~/utilities/time";

export interface ArticleSummaryProps {
  title: string;
  date: string;
  path: string;
  topic: string;
  description: string;
  readTime: number;
  coverImageMarkup: string;
}

export const ArticleSummaryItem = component$<ArticleSummaryProps>(
  ({ title, date, path, description, topic, readTime, coverImageMarkup }) => {
    const { scopeId } = useStylesScoped$(styles);

    const dateParsed = new Date(date);
    const dateFormatted = formatDateAsString(dateParsed);

    // Qwik will not automatically add the scoped styles to injected HTML,
    // so as a workaround we manually insert it as a class name to any
    // figure, picture, and img HTML elements in the markup string.
    const coverImageWithScopeId = coverImageMarkup.replace(
      /<(figure|picture|img)([^>]*)>/g,
      (_, tag, attributes) => `<${tag}${attributes} class="${scopeId}">`
    );

    return (
      <li class="article-summary">
        <Link class={scopeId} href={`/blog/${path}/`} prefetch>
          <time dateTime={dateParsed.toISOString()}>{dateFormatted}</time>
          <h4>{title}</h4>

          <div
            class="article-summary-cover-image"
            dangerouslySetInnerHTML={coverImageWithScopeId}
          ></div>

          <p>{description}</p>

          <div class="article-summary-read-info">
            <p>Talks about {topic}</p>
            <p>~{readTime} min read</p>
          </div>
        </Link>
      </li>
    );
  }
);
