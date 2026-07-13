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

// Moderate document rules wait for user intent, so destination startup work
// happens before activation without competing with the current first paint.
const INTENT_NAVIGATION_PRERENDER_RULES = JSON.stringify({
  prerender: [
    {
      eagerness: "moderate",
      where: { href_matches: "/*" },
    },
  ],
});

// Intersection observers stay suspended while a document is prerendering.
// Resume only glyph tasks at Qwik initialization so their runtime renderers
// and frame streams are ready before the hidden document is activated.
const PRERENDER_GLYPH_RESUME_SCRIPT = `document.prerendering&&document.addEventListener("qinit",()=>{for(const element of document.querySelectorAll(".glyph-raster[on\\\\:qvisible],.glyph-raster-region[on\\\\:qvisible]")){const qrl=element.getAttribute("on:qvisible");element.dispatchEvent(new CustomEvent("qvisible",{bubbles:true,detail:{isIntersecting:true}}));element.removeAttribute("on:qvisible");queueMicrotask(()=>qrl&&element.setAttribute("on:qvisible",qrl));}},{once:true});`;

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

      <script type="speculationrules" dangerouslySetInnerHTML={INTENT_NAVIGATION_PRERENDER_RULES} />
      <script dangerouslySetInnerHTML={PRERENDER_GLYPH_RESUME_SCRIPT} />

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
