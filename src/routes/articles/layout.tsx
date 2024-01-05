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

  return {
    title,
    links: [
      {
        rel: "stylesheet",
        href: "https://cdnjs.cloudflare.com/ajax/libs/prism/1.27.0/themes/prism.min.css",
      },
    ],
  };
};
