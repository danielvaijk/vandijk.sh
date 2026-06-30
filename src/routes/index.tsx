import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHeadValue } from "@builder.io/qwik-city";
import { type DocumentHead } from "@builder.io/qwik-city";
import TypeIt from "typeit";

import { SplashBackground } from "src/components/splash-background";
import { createPageMetaTags } from "src/helpers/meta";
import styles from "src/routes/index.scss?inline";

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  useVisibleTask$(({ cleanup }): void => {
    const continueToHome = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.code !== "Enter") return;

      window.location.assign("/home/");
    };

    window.addEventListener("keydown", continueToHome, { capture: true });

    cleanup(() => {
      window.removeEventListener("keydown", continueToHome, { capture: true });
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

  return (
    <section class="homepage-splash-stage">
      <SplashBackground variant="eye" />
      <h2 id="homepage-title">Hey there, I'm Daniel.</h2>
      <strong>press enter to continue</strong>
    </section>
  );
});

export const head: DocumentHead = (): DocumentHeadValue => {
  const title = "Daniel van Dijk";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { meta: createPageMetaTags({ description, title }), title };
};
