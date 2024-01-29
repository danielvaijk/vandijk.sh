import { component$, Slot, useStyles$ } from "@builder.io/qwik";
import { useLocation, type DocumentHead } from "@builder.io/qwik-city";

import { createPageMetaTags } from "~/helpers/meta";

import stylesForLayout from "./layout.css?inline";
import stylesForCodeHighlights from "../../styles/code.css?inline";

export default component$(() => {
  useStyles$(stylesForLayout);
  useStyles$(stylesForCodeHighlights);

  const location = useLocation();
  const isAtRoot = location.url.pathname.endsWith("/articles/");
  const isDev404 = location.url.pathname.endsWith("/404.html");
  const shouldShowFooter = !isDev404 && !isAtRoot;

  return (
    <>
      <Slot />
      {shouldShowFooter && <footer>Thanks for reading!</footer>}
    </>
  );
});

export const head: DocumentHead = ({ head }) => {
  const isArticle = Boolean(head.title);

  // For article pages the title is set in the MDX frontmatter, but we override it
  // to include a base title. The original title (without the base) is still used
  // for the Open Graph title, so it's not completely useless.
  const titleBase = "Daniel van Dijk's Blog";
  const title = isArticle ? `${titleBase} - ${head.title}` : titleBase;

  if (isArticle) {
    return { title };
  }

  const description =
    "I explore and write about a wide range of engineering topics and challenges.";
  const meta = createPageMetaTags({ title, description });

  return { title, meta };
};
