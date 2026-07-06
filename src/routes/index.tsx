import type { QwikJSX } from "@builder.io/qwik";
import { $, component$, useSignal, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHeadValue } from "@builder.io/qwik-city";
import { type DocumentHead, useNavigate } from "@builder.io/qwik-city";
import type TypeIt from "typeit";

import { CenteredTitle } from "src/components/centered-title";
import { GlyphRaster } from "src/components/glyph-raster";
import { animateGlyphWhiteout } from "src/components/glyph-whiteout-state";
import { createHoldHaptics } from "src/helpers/haptics";
import { createPageMetaTags } from "src/helpers/meta";
import styles from "src/routes/index.scss?inline";

const WHITEOUT_RAMP_UP_MS = 1400;
const WHITEOUT_RELEASE_MS = 600;
const WHITEOUT_HOLD_MS = 700;
const WHITEOUT_FADE_OUT_MS = 1400;

export default component$((): QwikJSX.Element => {
  const continuePrompt = useSignal("hold any key to continue");
  const navigate = useNavigate();

  useStylesScoped$(styles);

  useVisibleTask$(({ cleanup }): void => {
    const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    continuePrompt.value = hasTouch ? "tap and hold to continue" : "hold any key to continue";

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const haptics = createHoldHaptics(WHITEOUT_RAMP_UP_MS);
    const heldSources = new Set<string>();
    let hasPreloaded = false;
    let isNavigating = false;
    let navigateTimeout = 0;

    // Warm the HTTP cache for the blog route's data while the whiteout ramps
    // up, so the navigation at full white resolves near-instantly.
    const preloadBlogData = (): void => {
      if (hasPreloaded) return;
      hasPreloaded = true;

      void fetch("/blog/q-data.json").catch((): void => {});
    };

    const continueToBlog = (): void => {
      void navigate("/blog/").finally((): void => {
        void animateGlyphWhiteout(0, WHITEOUT_FADE_OUT_MS);
      });
    };

    // Reaching full white is the commitment point: the field dwells there for
    // a beat, then navigates and fades down over the blog page.
    const commitToBlog = (dwellMs: number): void => {
      if (isNavigating) return;
      isNavigating = true;

      haptics.confirm();
      navigateTimeout = window.setTimeout(continueToBlog, dwellMs);
    };

    const beginHold = (source: string): void => {
      if (isNavigating) return;

      preloadBlogData();

      if (prefersReducedMotion) {
        commitToBlog(0);
        return;
      }

      const isFirstSource = heldSources.size === 0;
      heldSources.add(source);
      if (!isFirstSource) return;

      haptics.start();
      void animateGlyphWhiteout(1, WHITEOUT_RAMP_UP_MS).then((didComplete): void => {
        if (didComplete && heldSources.size > 0) {
          commitToBlog(WHITEOUT_HOLD_MS);
        }
      });
    };

    const endHold = (source: string): void => {
      heldSources.delete(source);
      if (heldSources.size > 0 || isNavigating) return;

      haptics.stop();
      void animateGlyphWhiteout(0, WHITEOUT_RELEASE_MS);
    };

    const releaseAllHolds = (): void => {
      heldSources.clear();
      if (isNavigating) return;

      haptics.stop();
      void animateGlyphWhiteout(0, WHITEOUT_RELEASE_MS);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;

      beginHold(`key:${event.code}`);
    };
    const onKeyUp = (event: KeyboardEvent): void => endHold(`key:${event.code}`);
    const onPointerDown = (event: PointerEvent): void => beginHold(`pointer:${event.pointerId}`);
    const onPointerUp = (event: PointerEvent): void => endHold(`pointer:${event.pointerId}`);

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointerup", onPointerUp, { capture: true });
    window.addEventListener("pointercancel", onPointerUp, { capture: true });
    window.addEventListener("blur", releaseAllHolds);

    cleanup(() => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("pointerup", onPointerUp, { capture: true });
      window.removeEventListener("pointercancel", onPointerUp, { capture: true });
      window.removeEventListener("blur", releaseAllHolds);
      window.clearTimeout(navigateTimeout);
      // The post-navigation fade-out is owned by continueToBlog; only reset
      // the whiteout here when the page unmounts without navigating.
      releaseAllHolds();
      haptics.dispose();
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
    meta: createPageMetaTags({ description, title }),
    title,
  };
};
