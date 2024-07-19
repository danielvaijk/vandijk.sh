import { component$, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import TypeIt from "typeit";

import { createPageMetaTags } from "~/helpers/meta";

import styles from "./index.css?inline";

export default component$(() => {
  useStylesScoped$(styles);

  useVisibleTask$(() => {
    new TypeIt("#homepage-title", { loop: true, loopDelay: 10000 })
      .pause(6000)
      .delete()
      .pause(1200)
      .type("Don't be shy...")
      .go();
  });

  return (
    <div id="homepage">
      <h2 id="homepage-title">Hey there, I'm Daniel.</h2>
      <p>
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
          articles
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
      </p>
    </div>
  );
});

export const head: DocumentHead = () => {
  const title = "Daniel van Dijk";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { title, meta: createPageMetaTags({ title, description }) };
};
