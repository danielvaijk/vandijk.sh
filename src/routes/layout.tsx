import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";
import { Header } from "~/components/header";

import styles from "./layout.css?inline";

export default component$(() => {
  useStylesScoped$(styles);

  return (
    <>
      <Header />

      <main>
        <Slot />
      </main>
    </>
  );
});
