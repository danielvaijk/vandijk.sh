// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { useDocumentHead, useLocation } from "@builder.io/qwik-city";

export const DocumentHead = component$((): QwikJSX.Element => {
  const head = useDocumentHead();
  const { url } = useLocation();

  return (
    <head>
      <title>{head.title}</title>

      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {head.meta.map(
        ({ key, ...props }): QwikJSX.Element => (
          <meta key={key} {...props} />
        )
      )}

      <link rel="canonical" href={url.href} />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />

      {head.links.map(
        ({ key, ...props }): QwikJSX.Element => (
          <link key={key} {...props} />
        )
      )}

      {head.styles.map(
        ({ key, props, style }): QwikJSX.Element => (
          <style key={key} {...props} dangerouslySetInnerHTML={style} />
        )
      )}

      <script
        dangerouslySetInnerHTML={`
        (function() {
          var currentTheme = localStorage.getItem("theme");
          var prefersColorScheme = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

          function setAndSaveTheme(targetTheme) {
            document.documentElement.className = targetTheme;
            localStorage.setItem("theme", targetTheme);
          }

          if (currentTheme) {
            document.documentElement.className = currentTheme;
          } else if (prefersColorScheme && prefersColorScheme.matches) {
            setAndSaveTheme("dark");
          } else {
            setAndSaveTheme("light");
          }

          // Listen to color scheme system preference changes.
          if (prefersColorScheme) {
            prefersColorScheme.addEventListener("change", function(changeEvent) {
              if (changeEvent.matches) {
                setAndSaveTheme("dark");
              } else {
                setAndSaveTheme("light");
              }
            });
          }
        })();
      `}
      ></script>

      <noscript>
        <style
          dangerouslySetInnerHTML={`
          .js-only {
            display: none !important;
          }
        `}
        ></style>
      </noscript>
    </head>
  );
});
