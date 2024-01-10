import type { DocumentMeta } from "@builder.io/qwik-city";

function createPageMetaTags({
  title,
  description,
}: {
  title: string;
  description: string;
}): Array<DocumentMeta> {
  return [
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "en_US" },
    { property: "og:site_name", content: "Daniel van Dijk" },
  ];
}

export { createPageMetaTags };
