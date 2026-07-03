import type { QwikJSX } from "@builder.io/qwik";
import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";

import { GlyphRaster } from "src/components/glyph-raster";
import { GlyphTextReveal } from "src/components/glyph-text-reveal";
import { NavigationHeader } from "src/components/navigation/navigation-header";
import styles from "src/routes/layout.scss?inline";

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  const { url } = useLocation();
  const isHomepage = url.pathname === "/";

  return (
    <>
      <GlyphRaster opacity={0.6} source={{ type: "procedural-noise" }} />

      {!isHomepage && <NavigationHeader />}

      <main class={isHomepage ? "is-homepage" : undefined}>
        <Slot />
      </main>

      <GlyphTextReveal routeKey={url.pathname} />
    </>
  );
});
