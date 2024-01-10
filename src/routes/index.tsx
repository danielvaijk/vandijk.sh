import { component$ } from "@builder.io/qwik";
import type { DocumentHead, RequestHandler } from "@builder.io/qwik-city";

import { createPageMetaTags } from "~/helpers/meta";

export const onGet: RequestHandler = async ({ redirect, url }) => {
  throw redirect(307, new URL("/articles/", url).toString());
};

export default component$(() => {
  return null;
});

export const head: DocumentHead = () => {
  const title = "Daniel van Dijk";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { title, meta: createPageMetaTags({ title, description }) };
};
