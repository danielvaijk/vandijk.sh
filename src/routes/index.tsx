import type { QwikJSX } from "@builder.io/qwik";
import { component$, useSignal, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHeadValue } from "@builder.io/qwik-city";
import { type DocumentHead, useNavigate } from "@builder.io/qwik-city";
import TypeIt from "typeit";

import { GlyphRaster } from "src/components/glyph-raster";
import { createPageMetaTags } from "src/helpers/meta";
import styles from "src/routes/index.scss?inline";

const GLYPH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
const GLYPH_IN_DURATION = 520;
const GLYPH_IN_FRAME_RATE = 1000 / 24;

const randomGlyph = (): string => GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)];

const glyphInElement = (element: HTMLElement): (() => void) => {
  const originalText = element.textContent ?? "";
  const originalCharacters = Array.from(originalText);
  let animationFrame = 0;
  let isComplete = false;
  let startedAt = 0;
  let lastFrameAt = 0;

  const render = (time: number): void => {
    if (startedAt === 0) startedAt = time;
    if (time - lastFrameAt < GLYPH_IN_FRAME_RATE) {
      animationFrame = requestAnimationFrame(render);
      return;
    }

    lastFrameAt = time;

    const progress = Math.min(1, (time - startedAt) / GLYPH_IN_DURATION);
    const revealCount = Math.floor(originalCharacters.length * progress);

    element.textContent = originalCharacters
      .map((character, index): string => {
        if (/\s/u.test(character) || index < revealCount) return character;

        return randomGlyph();
      })
      .join("");

    if (progress < 1) {
      animationFrame = requestAnimationFrame(render);
    } else {
      isComplete = true;
      element.textContent = originalText;
    }
  };

  animationFrame = requestAnimationFrame(render);

  return (): void => {
    cancelAnimationFrame(animationFrame);
    if (!isComplete) {
      element.textContent = originalText;
    }
  };
};

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

  useVisibleTask$(({ cleanup }): void => {
    const typeIt = new TypeIt("#homepage-title", {
      loop: true,
      startDelay: 6000,
      startDelete: true,
    });

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
      .pause(10000)
      .go();

    cleanup(() => {
      typeIt.destroy();
    });
  });

  useVisibleTask$(({ cleanup, track }): void => {
    track(() => continuePrompt.value);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const subtitle = document.getElementById("homepage-subtitle");
    const restoreAnimation = subtitle instanceof HTMLElement ? glyphInElement(subtitle) : null;

    cleanup(() => {
      if (restoreAnimation) {
        restoreAnimation();
      }
    });
  });

  return (
    <section class="homepage-splash-stage">
      <GlyphRaster blend={0.4} source={{ type: "frames", url: "/eye.frames" }} />
      <h2 id="homepage-title">Hey there, I'm Daniel.</h2>
      <strong id="homepage-subtitle">{continuePrompt.value}</strong>
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
