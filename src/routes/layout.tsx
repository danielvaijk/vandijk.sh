import type { QwikJSX } from "@builder.io/qwik";
import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";

import { NavigationHeader } from "src/components/navigation/navigation-header";
import styles from "src/routes/layout.scss?inline";

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  const { url } = useLocation();
  const isHomepage = url.pathname === "/";

  return (
    <>
      {!isHomepage && <NavigationHeader />}

      <main>
        <Slot />
      </main>
    </>
  );
});
