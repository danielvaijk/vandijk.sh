import { $, type QwikJSX, component$, useOnWindow } from "@builder.io/qwik";
import {
  QwikCityProvider,
  RouterOutlet,
  useDocumentHead,
  useLocation,
} from "@builder.io/qwik-city";

// Qwik will try to inline this file in production mode if the amount
// of CSS is less than 10KB. If the file is larger than 10KB, it will
// be loaded as a separate file.
import "src/global.css";

const RootHead = component$((): QwikJSX.Element => {
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
        ),
      )}

      <link rel="canonical" href={url.href} />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />

      {head.links.map(
        ({ key, ...props }): QwikJSX.Element => (
          <link key={key} {...props} />
        ),
      )}

      {head.styles.map(
        ({ key, props, style }): QwikJSX.Element => (
          <style key={key} {...props} dangerouslySetInnerHTML={style} />
        ),
      )}
    </head>
  );
});

const RootBody = component$((): QwikJSX.Element => {
  useOnWindow(
    "load",
    $((): void => {
      console.info(
        "Hello there! If you're looking for the source code, you can find it here: https://github.com/danielvaijk/vandijk.sh",
      );
    }),
  );

  return (
    <body>
      <RouterOutlet />
    </body>
  );
});

export default component$((): QwikJSX.Element => {
  return (
    <QwikCityProvider>
      <RootHead />
      <RootBody />
    </QwikCityProvider>
  );
});
