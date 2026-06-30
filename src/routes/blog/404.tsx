import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { CenteredTitle } from "src/components/centered-title";
import { SplashBackground } from "src/components/splash-background";

export default component$((): QwikJSX.Element => {
  return (
    <>
      <SplashBackground />
      <CenteredTitle title="404" subtitle="The article you're looking for doesn't exist." />
    </>
  );
});
