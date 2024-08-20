import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const NavigationHeaderName = component$((): QwikJSX.Element => {
  return (
    <Link id="header-name" href="/" prefetch>
      <h2>aniel van Dijk</h2>
    </Link>
  );
});
