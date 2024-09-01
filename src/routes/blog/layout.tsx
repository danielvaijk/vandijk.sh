// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, Slot, useStyles$ } from "@builder.io/qwik";
import type { DocumentHeadProps, DocumentHeadValue } from "@builder.io/qwik-city";
import { useLocation, type DocumentHead } from "@builder.io/qwik-city";

import { createPageMetaTags } from "src/helpers/meta";
import stylesForLayout from "src/routes/blog/layout.scss?inline";
import stylesForCodeHighlights from "src/styles/base/code.scss?inline";

export default component$((): QwikJSX.Element => {
  useStyles$(stylesForLayout);
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
    return { title };
  }

  const description =
    "I explore and write about a wide range of engineering topics and challenges.";

  const meta = createPageMetaTags({ description, title });

  return { meta, title };
};
