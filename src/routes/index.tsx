import type { DocumentHead, RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async ({ redirect, url }) => {
  throw redirect(307, new URL("/articles/", url).toString());
};

export const head: DocumentHead = {
  title: "Daniel van Dijk",
};
