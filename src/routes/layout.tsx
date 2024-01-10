import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";

import { NavigationHeader } from "~/components/navigation/navigation-header";

import styles from "./layout.css?inline";

export default component$(() => {
  useStylesScoped$(styles);

  return (
    <>
      <NavigationHeader />

      <main>
        <Slot />
      </main>
    </>
  );
});
