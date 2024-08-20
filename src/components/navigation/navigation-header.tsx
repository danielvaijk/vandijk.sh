import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { NavigationHeaderItems } from "src/components/navigation/navigation-header-items";
import { NavigationHeaderName } from "src/components/navigation/navigation-header-name";

export const NavigationHeader = component$((): QwikJSX.Element => {
  return (
    <header>
      <NavigationHeaderName />
      <NavigationHeaderItems />
    </header>
  );
});
