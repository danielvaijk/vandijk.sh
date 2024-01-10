import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

import { CenteredTitle } from "~/components/centered-title";
import { createPageMetaTags } from "~/helpers/meta";

export default component$(() => {
  return <CenteredTitle title="TODO" subtitle="Nothing to see here yet." />;
});

export const head: DocumentHead = () => {
  const title = "Daniel van Dijk's Resume";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { title, meta: createPageMetaTags({ title, description }) };
};
