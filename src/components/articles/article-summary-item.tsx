import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import styles from "./article-summary-item.css?inline";

export interface ArticleSummaryProps {
  title: string;
  date: string;
  path: string;
  description: string;
}

export const ArticleSummaryItem = component$<ArticleSummaryProps>(
  ({ title, date, path, description }) => {
    const { scopeId } = useStylesScoped$(styles);

    return (
      <li class="article-summary">
        <Link class={scopeId} href={`/articles/${path}`}>
          <time>{date}</time>
          <h4>{title}</h4>
          <p>{description}</p>
        </Link>
      </li>
    );
  }
);
