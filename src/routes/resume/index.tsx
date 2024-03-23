import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

import { createPageMetaTags } from "~/helpers/meta";
import { Resume } from "~/routes/resume/resume";

export default component$(() => {
  return <Resume />;
});

export const head: DocumentHead = () => {
  const title = "Daniel van Dijk's Resume";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { title, meta: createPageMetaTags({ title, description }) };
};
