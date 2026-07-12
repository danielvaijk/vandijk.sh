import type { QwikJSX } from "@builder.io/qwik";
import { $, component$, useSignal, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHeadValue } from "@builder.io/qwik-city";
import { type DocumentHead, useNavigate } from "@builder.io/qwik-city";
import type TypeIt from "typeit";

import { CenteredTitle } from "src/components/centered-title";
import { GlyphRaster } from "src/components/glyph-raster";
import styles from "src/routes/index.css?inline";

export default component$((): QwikJSX.Element => {
  const continuePrompt = useSignal("press any key to continue");
  const navigate = useNavigate();

  useStylesScoped$(styles);

  useVisibleTask$(({ cleanup }): void => {
    const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    continuePrompt.value = hasTouch ? "tap to continue" : "press any key to continue";

    const continueToBlog = (): void => {
      void navigate("/blog/");
    };

    window.addEventListener("keydown", continueToBlog, { capture: true });
    window.addEventListener("touchstart", continueToBlog, { capture: true });

    cleanup(() => {
      window.removeEventListener("keydown", continueToBlog, { capture: true });
      window.removeEventListener("touchstart", continueToBlog, { capture: true });
    });
  });

  return (
    <section class="homepage-splash-stage">
      <GlyphRaster blend={0.6} frameFit="cover" source={{ type: "frames", url: "/eye.frames" }} />
      <CenteredTitle
        subtitle={continuePrompt.value}
        subtitleId="homepage-subtitle"
        title="Hey there, I'm Daniel."
        titleId="homepage-title"
        typeTitle$={$((typeIt: TypeIt): void => {
          typeIt
            .delete()
            .pause(1200)
            .type("Don't be shy")
            .pause(1000)
            .type(".")
            .pause(800)
            .type(".")
            .pause(800)
            .type(".")
            .pause(6000)
            .delete()
            .pause(3000)
            .type("Hey there, I'm")
            .pause(800)
            .type(" ")
            .pause(400)
            .type("Daniel", { instant: true })
            .pause(300)
            .type(".")
            .pause(10000);
        })}
        typeTitleOptions={{ loop: true, startDelay: 6000, startDelete: true }}
      />
    </section>
  );
});

export const head: DocumentHead = (): DocumentHeadValue => {
  const title = "Daniel van Dijk";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return {
    meta: [
      { content: description, name: "description" },
      { content: title, property: "og:title" },
      { content: description, property: "og:description" },
      { content: "website", property: "og:type" },
      { content: "en_US", property: "og:locale" },
      { content: "Daniel van Dijk", property: "og:site_name" },
    ],
    title,
  };
};
