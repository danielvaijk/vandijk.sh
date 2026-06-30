import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

import { CenteredTitle } from "src/components/centered-title";
import { SplashBackground } from "src/components/splash-background";

export default component$((): QwikJSX.Element => {
  return (
    <>
      <SplashBackground />
      <CenteredTitle title="404" subtitle="This page doesn't exist." />
    </>
  );
});

export const head: DocumentHead = {
  title: "Daniel van Dijk - Not Found",
};
