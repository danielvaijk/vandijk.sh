import {
  $,
  type QwikJSX,
  component$,
  useSignal,
  useStylesScoped$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { type DocumentHead, type DocumentHeadValue } from "@builder.io/qwik-city";
import type TypeIt from "typeit";

import { CenteredTitle } from "src/components/centered-title";
import { GlyphRaster } from "src/components/glyph-raster";
import styles from "src/routes/index.css?inline";

// This rule is rendered after the splash subtree so its unconditional
// Prefetch cannot get ahead of the homepage's streamed first-paint markup.
const BLOG_NAVIGATION_PREFETCH_RULES = JSON.stringify({
  prefetch: [
    {
      eagerness: "immediate",
      urls: ["/blog/"],
    },
  ],
});

export default component$((): QwikJSX.Element => {
  const continuePrompt = useSignal("press any key to continue");

  useStylesScoped$(styles);

  useVisibleTask$(({ cleanup }): void => {
    const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in globalThis;
    continuePrompt.value = hasTouch ? "tap to continue" : "press any key to continue";

    const continueToBlog = (): void => {
      globalThis.location.assign("/blog/");
    };

    globalThis.addEventListener("keydown", continueToBlog, { capture: true });
    globalThis.addEventListener("touchstart", continueToBlog, { capture: true });

    cleanup(() => {
      globalThis.removeEventListener("keydown", continueToBlog, { capture: true });
      globalThis.removeEventListener("touchstart", continueToBlog, { capture: true });
    });
  });

  return (
    <>
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
              .pause(10_000);
          })}
          typeTitleOptions={{ loop: true, startDelay: 6000, startDelete: true }}
        />
      </section>

      <script type="speculationrules" dangerouslySetInnerHTML={BLOG_NAVIGATION_PREFETCH_RULES} />
    </>
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
