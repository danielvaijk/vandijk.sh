import { type QwikJSX, component$, useStyles$ } from "@builder.io/qwik";

import { NavigationHeaderItems } from "src/components/navigation-header-items";
import { NavigationHeaderName } from "src/components/navigation-header-name";
import styles from "src/components/navigation-header.css?inline";

export const NavigationHeader = component$((): QwikJSX.Element => {
  useStyles$(styles);

  return (
    <header>
      <NavigationHeaderName />
      <NavigationHeaderItems />
    </header>
  );
});
