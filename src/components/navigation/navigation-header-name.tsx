import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import ImgFavicon from "src/media/favicon.jpg?jsx";

export const NavigationHeaderName = component$((): QwikJSX.Element => {
  return (
    <Link id="header-name" href="/" prefetch>
      <ImgFavicon decoding="sync" loading="eager" alt="Website icon with 'D' initial" />
      <h2>aniel van Dijk</h2>
    </Link>
  );
});
