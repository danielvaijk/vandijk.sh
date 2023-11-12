import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { CenteredTitle } from "~/components/centered-title";

export default component$(() => {
  return <CenteredTitle title="404" subtitle="This page doesn't exist." />;
});

export const head: DocumentHead = {
  title: "Daniel van Dijk - Not Found",
};
