import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

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

export const head: DocumentHead = {
  links: [
    {
      rel: "stylesheet",
      href: "https://cdnjs.cloudflare.com/ajax/libs/modern-normalize/2.0.0/modern-normalize.min.css",
      integrity:
        "sha512-4xo8blKMVCiXpTaLzQSLSw3KFOVPWhm/TRtuPVc4WG6kUgjH6J03IBuG7JZPkcWMxJ5huwaBpOpnwYElP/m6wg==",
      crossorigin: "anonymous",
      referrerpolicy: "no-referrer",
    },
  ],
};
