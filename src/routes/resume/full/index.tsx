import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { Resume } from "src/routes/resume/resume";

export default component$((): QwikJSX.Element => {
  return <Resume showFull />;
});

export { head } from "../index";
