import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

import { CenteredTitle } from "~/components/centered-title";

export default component$(() => {
  return <CenteredTitle title="TODO" subtitle="Nothing to see here yet." />;
});

export const head: DocumentHead = {
  title: "Daniel van Dijk - Contact",
};
