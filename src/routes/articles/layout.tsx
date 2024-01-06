import { component$, Slot, useStyles$ } from "@builder.io/qwik";
import { useLocation, type DocumentHead } from "@builder.io/qwik-city";

import styles from "./layout.css?inline";

export default component$(() => {
  useStyles$(styles);

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
  const titleBase = "Daniel van Dijk's Blog";
  const title = head.title ? `${titleBase} - ${head.title}` : titleBase;

  const links = [];

  // We only want to include syntax highlighting for code snippets
  // on actual article pages, which might contain the content.
  if (head.title) {
    links.push({
      rel: "preload",
      as: "style",
      onload: "this.onload=null;this.rel='stylesheet'",
      href: "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css",
      integrity:
        "sha512-vswe+cgvic/XBoF1OcM/TeJ2FW0OofqAVdCZiEYkd6dwGXthvkSFWOoGGJgS2CW70VK5dQM5Oh+7ne47s74VTg==",
      crossorigin: "anonymous",
      referrerpolicy: "no-referrer",
    });
  }

  return { title, links };
};
