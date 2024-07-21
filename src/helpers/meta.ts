import type { DocumentMeta } from "@builder.io/qwik-city";

function createPageMetaTags({
  description,
  title,
}: {
  description: string;
  title: string;
}): Array<DocumentMeta> {
  return [
    { content: description, name: "description" },
    { content: title, property: "og:title" },
    { content: description, property: "og:description" },
    { content: "website", property: "og:type" },
    { content: "en_US", property: "og:locale" },
    { content: "Daniel van Dijk", property: "og:site_name" },
  ];
}

export { createPageMetaTags };
