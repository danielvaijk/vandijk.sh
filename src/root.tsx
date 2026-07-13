import { $, type QwikJSX, component$, useOnWindow } from "@builder.io/qwik";
import {
  QwikCityProvider,
  RouterOutlet,
  useDocumentHead,
  useLocation,
} from "@builder.io/qwik-city";
import styles from "src/global.css?url";

// Qwik will try to inline this file in production mode if the amount
// Of CSS is less than 10KB. If the file is larger than 10KB, it will
// Be loaded as a separate file.

// Moderate document rules wait for user intent, so they can be discovered
// In the head without competing with the current document's first paint.
const INTENT_NAVIGATION_PREFETCH_RULES = JSON.stringify({
  prefetch: [
    {
      eagerness: "moderate",
      where: { href_matches: "/*" },
    },
  ],
});

const RootHead = component$((): QwikJSX.Element => {
  const head = useDocumentHead();
  const { url } = useLocation();

  return (
    <head>
      <title>{head.title}</title>

      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {head.meta.map(
        (meta): QwikJSX.Element => (
          <meta key={meta.key} {...meta} />
        ),
      )}

      <link rel="canonical" href={url.href} />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />

      <script type="speculationrules" dangerouslySetInnerHTML={INTENT_NAVIGATION_PREFETCH_RULES} />

      {head.links.map(
        (link): QwikJSX.Element => (
          <link key={link.key} {...link} />
        ),
      )}

      {head.styles.map(
        ({ key, props, style }): QwikJSX.Element => (
          <style key={key} {...props} dangerouslySetInnerHTML={style} />
        ),
      )}

      <link rel="stylesheet" href={styles} />
    </head>
  );
});

const RootBody = component$((): QwikJSX.Element => {
  useOnWindow(
    "load",
    $((): void => {
      /* Empty */
    }),
  );

  return (
    <body>
      <RouterOutlet />
    </body>
  );
});

export default component$(
  (): QwikJSX.Element => (
    <QwikCityProvider>
      <RootHead />
      <RootBody />
    </QwikCityProvider>
  ),
);
