// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

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
