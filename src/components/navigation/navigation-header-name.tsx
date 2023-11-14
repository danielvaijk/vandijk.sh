import { component$ } from "@builder.io/qwik";

export const NavigationHeaderName = component$(() => {
  return (
    <div id="header-name">
      <img src="/favicon.ico" width="60" height="60" />
      <h2>aniel van Dijk</h2>
    </div>
  );
});
