import { type QwikJSX, Slot, component$, useStylesScoped$ } from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";
import { useLocation } from "@builder.io/qwik-city";

import { GlyphRaster } from "src/components/glyph-raster";
import { GlyphTextReveal } from "src/components/glyph-text-reveal";
import { NavigationHeader } from "src/components/navigation-header";
import styles from "src/routes/layout.css?inline";
import glyphFramePosters from "virtual:glyph-frame-posters";

const ARTICLE_COVER_FRAME_PATH = /^\/blog\/[^/]+\/[\da-f]{16}-cover\.frames$/u;
const SITE_EYE_FRAME_PATH = /^\/[\da-f]{16}-eye\.frames$/u;

const resolveInitialFrameSources = (pathname: string): string[] => {
  if (!isServer) {
    return [];
  }

  const sources = Object.keys(glyphFramePosters);
  if (pathname === "/") {
    return sources.filter((source) => SITE_EYE_FRAME_PATH.test(source));
  }
  if (pathname === "/blog/") {
    return sources.filter((source) => ARTICLE_COVER_FRAME_PATH.test(source));
  }

  const routeSources = sources.filter((source) => source.startsWith(pathname));

  return routeSources.length > 0
    ? routeSources
    : sources.filter((source) => SITE_EYE_FRAME_PATH.test(source));
};

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  const { url } = useLocation();
  const isHomepage = url.pathname === "/";
  const initialFrameSources = resolveInitialFrameSources(url.pathname);

  return (
    <>
      {!isHomepage && <NavigationHeader />}

      <main class={isHomepage ? "is-homepage" : null}>
        <Slot />
      </main>

      <GlyphRaster
        anchor={isHomepage ? "viewport" : "auto"}
        initialFrameSources={initialFrameSources}
        opacity={0.6}
        source={{ type: "procedural-noise" }}
      />

      <GlyphTextReveal routeKey={url.pathname} />
    </>
  );
});
