import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { CenteredTitle } from "src/components/centered-title";

export default component$((): QwikJSX.Element => {
  return <CenteredTitle title="404" subtitle="The article you're looking for doesn't exist." />;
});
