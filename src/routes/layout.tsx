import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";

import { NavigationHeader } from "~/components/navigation/navigation-header";

import styles from "./layout.css?inline";

export default component$(() => {
  useStylesScoped$(styles);

  const location = useLocation();
  const isHomepage = location.url.pathname === "/";

  return (
    <>
      {!isHomepage && <NavigationHeader />}

      <main>
        <Slot />
      </main>
    </>
  );
});
