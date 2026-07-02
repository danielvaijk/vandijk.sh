import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { GlyphRaster } from "src/components/glyph-raster";

interface ArticleGlyphImageProps {
  alt: string;
  framesPath: string;
}

export const ArticleGlyphImage = component$(
  ({ alt, framesPath }: ArticleGlyphImageProps): QwikJSX.Element => {
    return (
      <div class="article-image-glyph-raster">
        <GlyphRaster layout="fill" source={{ type: "frames", url: framesPath }} />

        <figure aria-label={alt} role="img" />
      </div>
    );
  },
);
