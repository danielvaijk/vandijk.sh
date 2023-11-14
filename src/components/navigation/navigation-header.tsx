import { component$ } from "@builder.io/qwik";
import { NavigationHeaderLinks } from "./navigation-header-links";
import { NavigationHeaderName } from "./navigation-header-name";

export const NavigationHeader = component$(() => {
  return (
    <header>
      <NavigationHeaderName />
      <NavigationHeaderLinks />
    </header>
  );
});
