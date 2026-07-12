import { type QwikJSX, component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const NavigationHeaderName = component$(
  (): QwikJSX.Element => (
    <Link id="header-name" href="/" prefetch>
      <h2>Daniel van Dijk</h2>
    </Link>
  ),
);
