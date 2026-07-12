import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import { GlyphRaster } from "src/components/glyph-raster";
import styles from "src/components/article-summary-item.css?inline";

export interface ArticleSummaryProps {
  coverImageFramesPath?: string;
  coverImageMarkup: string;
  coverImagePublicPath: string;
  date: string;
  description: string;
  path: string;
  readTime: number;
  title: string;
  topic: string;
}

export const ArticleSummaryItem = component$<ArticleSummaryProps>(
  ({
    coverImageFramesPath,
    coverImageMarkup,
    date,
    description,
    path,
    readTime,
    title,
    topic,
  }): QwikJSX.Element => {
    const { scopeId } = useStylesScoped$(styles);

    const dateParsed = new Date(date);
    const dateFormatted = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(dateParsed);

    // Qwik will not automatically add the scoped styles to injected HTML,
    // so as a workaround we manually insert it as a class name to any
    // figure, picture, and img HTML elements in the markup string.
    const coverImageWithScopeId = coverImageMarkup.replace(
      /<(?<tag>figure|picture|img)(?<attributes>[^>]*)>/gu,
      (_, tag: string, attributes: string): string => `<${tag}${attributes} class="${scopeId}">`,
    );

    return (
      <li class="article-summary">
        <Link class={scopeId} href={`/blog/${path}/`} prefetch>
          <div class="article-summary-cover-image">
            {coverImageFramesPath && (
              <GlyphRaster
                class={scopeId}
                layout="fill"
                source={{ type: "frames", url: coverImageFramesPath }}
              />
            )}

            <div dangerouslySetInnerHTML={coverImageWithScopeId}></div>
          </div>

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
  },
);
