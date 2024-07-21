import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { NavigationHeaderLinks } from "src/components/navigation/navigation-header-links";
import { NavigationHeaderName } from "src/components/navigation/navigation-header-name";

export const NavigationHeader = component$((): QwikJSX.Element => {
  return (
    <header>
      <NavigationHeaderName />
      <NavigationHeaderLinks />
    </header>
  );
});
