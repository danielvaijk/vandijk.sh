import { component$ } from "@builder.io/qwik";

import { Resume } from "~/routes/resume/resume";

export default component$(() => {
  return <Resume showFull />;
});

export { head } from "../index";
