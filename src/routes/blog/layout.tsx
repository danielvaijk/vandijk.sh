import type { QwikJSX } from "@builder.io/qwik";
import { component$, Slot, useStyles$ } from "@builder.io/qwik";
import type { DocumentHeadProps, DocumentHeadValue, DocumentMeta } from "@builder.io/qwik-city";
import { useLocation, type DocumentHead } from "@builder.io/qwik-city";

import stylesForLayout from "src/routes/blog/layout.css?inline";
import stylesForFooter from "src/routes/blog/footer.css?inline";
import stylesForCodeHighlights from "src/routes/blog/code.css?inline";

interface ArticleFrontmatter {
  cover?: unknown;
  coverAlt?: unknown;
  date?: unknown;
  topic?: unknown;
}

function getMetaContent(meta: readonly DocumentMeta[] | undefined, name: string): string {
  const item = meta?.find((value): boolean => value.name === name);

  return typeof item?.content === "string" ? item.content : "";
}

function getCaptionAltText(captionRaw: string): string {
  return captionRaw.replace(/^\s*(?:\(.*?\))?\s*/u, "");
}

function createArticleMetaTags({
  cover,
  coverAlt,
  date,
  description,
  pageUrl,
  title,
  topic,
}: {
  cover: string;
  coverAlt: string;
  date: string;
  description: string;
  pageUrl: URL;
  title: string;
  topic: string;
}): Array<DocumentMeta> {
  const imageUrl = new URL(cover, pageUrl).toString();
  const pageUrlString = pageUrl.toString();
  const imageAlt = getCaptionAltText(coverAlt);

  return [
    { content: title, property: "og:title" },
    { content: description, property: "og:description" },
    { content: "article", property: "og:type" },
    { content: pageUrlString, property: "og:url" },
    { content: "Daniel van Dijk", property: "article:author" },
    { content: date, property: "article:published_time" },
    { content: topic, property: "article:tag" },
    { content: "en_US", property: "og:locale" },
    { content: "Daniel van Dijk", property: "og:site_name" },
    { content: imageUrl, property: "og:image" },
    { content: imageAlt, property: "og:image:alt" },
    { content: "summary_large_image", name: "twitter:card" },
    { content: title, name: "twitter:title" },
    { content: description, name: "twitter:description" },
    { content: imageUrl, name: "twitter:image" },
    { content: imageAlt, name: "twitter:image:alt" },
  ];
}

export default component$((): QwikJSX.Element => {
  useStyles$(stylesForLayout);
  useStyles$(stylesForFooter);
  useStyles$(stylesForCodeHighlights);

  const { url } = useLocation();
  const isAtRoot = url.pathname.endsWith("/blog/");
  const isDev404 = url.pathname.endsWith("/404.html");
  const shouldShowFooter = !isDev404 && !isAtRoot;

  return (
    <>
      <Slot />
      {shouldShowFooter && <footer>Thanks for reading!</footer>}
    </>
  );
});

export const head: DocumentHead = (props: DocumentHeadProps): DocumentHeadValue => {
  const isArticle = Boolean(props.head.title);

  // For article pages the title is set in the MDX frontmatter, but we override it
  // to include a base title. The original title (without the base) is still used
  // for the Open Graph title, so it's not completely useless.
  const titleBase = "Daniel van Dijk's Blog";
  const title = isArticle ? `${titleBase} - ${props.head.title}` : titleBase;

  if (isArticle) {
    const frontmatter = props.head.frontmatter as ArticleFrontmatter | undefined;
    const { cover, coverAlt, date, topic } = frontmatter ?? {};
    const description = getMetaContent(props.head.meta, "description");

    if (
      typeof cover === "string" &&
      typeof coverAlt === "string" &&
      typeof date === "string" &&
      typeof topic === "string" &&
      description.length > 0
    ) {
      return {
        meta: createArticleMetaTags({
          cover,
          coverAlt,
          date,
          description,
          pageUrl: props.url,
          title: props.head.title,
          topic,
        }),
        title,
      };
    }

    return { meta: props.head.meta, title };
  }

  const description =
    "I explore and write about a wide range of engineering topics and challenges.";

  const meta = [
    { content: description, name: "description" },
    { content: title, property: "og:title" },
    { content: description, property: "og:description" },
    { content: "website", property: "og:type" },
    { content: "en_US", property: "og:locale" },
    { content: "Daniel van Dijk", property: "og:site_name" },
  ];

  return { meta, title };
};
