import { component$ } from "@builder.io/qwik";

import ImgFavicon from "~/media/favicon.jpg?jsx";

export const NavigationHeaderName = component$(() => {
  return (
    <div id="header-name">
      <ImgFavicon decoding="sync" loading="eager" alt="Website icon with 'D' initial" />
      <h2>aniel van Dijk</h2>
    </div>
  );
});
