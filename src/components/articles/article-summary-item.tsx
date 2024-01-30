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
}

export const ArticleSummaryItem = component$<ArticleSummaryProps>(
  ({ title, date, path, description, topic, readTime }) => {
    const { scopeId } = useStylesScoped$(styles);

    const dateParsed = new Date(date);
    const dateFormatted = formatDateAsString(dateParsed);

    return (
      <li class="article-summary">
        <Link class={scopeId} href={`/articles/${path}/`} prefetch>
          <time dateTime={dateParsed.toISOString()}>{dateFormatted}</time>
          <h4>{title}</h4>
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
