// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHeadValue } from "@builder.io/qwik-city";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import TypeIt from "typeit";

import { createPageMetaTags } from "src/helpers/meta";
import styles from "src/routes/index.scss?inline";

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  // eslint-disable-next-line qwik/no-use-visible-task -- It's ok for this to block the main thread.
  useVisibleTask$((): void => {
    /* eslint-disable @typescript-eslint/no-magic-numbers -- Not magic. */
    new TypeIt("#homepage-title", {
      loop: true,
      startDelay: 6000,
      startDelete: true,
    })
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
    /* eslint-enable @typescript-eslint/no-magic-numbers -- Not magic. */
  });

  return (
    <div id="homepage">
      <h2 id="homepage-title">Hey there, I'm Daniel.</h2>
      <strong>
        Feel free to explore my{" "}
        <Link
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/danielvaijk?tab=repositories"
        >
          projects
        </Link>
        ,{" "}
        <Link href="/blog/" prefetch>
          blog
        </Link>
        ,{" "}
        <Link href="/resume/" prefetch>
          resume
        </Link>
        , or{" "}
        <Link
          target="_blank"
          rel="noopener noreferrer"
          href="https://www.linkedin.com/in/daniel-vandijk-sh/"
        >
          connect
        </Link>{" "}
        on LinkedIn.
      </strong>
    </div>
  );
});

export const head: DocumentHead = (): DocumentHeadValue => {
  const title = "Daniel van Dijk";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { meta: createPageMetaTags({ description, title }), title };
};
