import { type QwikJSX, component$ } from "@builder.io/qwik";

export const NavigationHeaderName = component$(
  (): QwikJSX.Element => (
    <a id="header-name" href="/">
      <h2>Daniel van Dijk</h2>
    </a>
  ),
);
