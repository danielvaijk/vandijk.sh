import { type QwikJSX, component$ } from "@builder.io/qwik";

import { GlyphRaster } from "src/components/glyph-raster";

interface ArticleGlyphImageProps {
  alt: string;
  framesPath: string;
}

export const ArticleGlyphImage = component$(
  ({ alt, framesPath }: ArticleGlyphImageProps): QwikJSX.Element => (
    <div class="article-image-glyph-raster">
      <GlyphRaster layout="fill" source={{ type: "frames", url: framesPath }} />

      <figure aria-label={alt} />
    </div>
  ),
);
