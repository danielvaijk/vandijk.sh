import { component$ } from "@builder.io/qwik";
import { useDocumentHead, useLocation } from "@builder.io/qwik-city";

export const DocumentHead = component$(() => {
  const head = useDocumentHead();
  const location = useLocation();

  return (
    <head>
      <title>{head.title}</title>

      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {head.meta.map(({ key, ...props }) => (
        <meta key={key} {...props} />
      ))}

      <link rel="canonical" href={location.url.href} />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />

      {head.links.map(({ key, ...props }) => (
        <link key={key} {...props} />
      ))}

      {head.styles.map(({ key, props, style }) => (
        <style key={key} {...props} dangerouslySetInnerHTML={style} />
      ))}
    </head>
  );
});
