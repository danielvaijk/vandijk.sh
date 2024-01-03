import { component$ } from "@builder.io/qwik";

import ImgFavicon from "~/media/favicon.jpg?jsx";

export const NavigationHeaderName = component$(() => {
  return (
    <div id="header-name">
      <ImgFavicon decoding="sync" loading="eager" style={{ width: "60px", height: "60px" }} />
      <h2>aniel van Dijk</h2>
    </div>
  );
});
