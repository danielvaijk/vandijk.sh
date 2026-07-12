import { type QwikJSX, component$, useStylesScoped$ } from "@builder.io/qwik";

import { CenteredTitle } from "src/components/centered-title";
import { GlyphRaster } from "src/components/glyph-raster";
import styles from "src/routes/404.css?inline";

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  return (
    <section class="not-found-stage">
      <GlyphRaster blend={0.6} frameFit="cover" source={{ type: "frames", url: "/eye.frames" }} />
      <CenteredTitle title="404" subtitle="This article doesn't exist." />
    </section>
  );
});
