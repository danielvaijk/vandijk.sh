import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { GlyphRaster } from "src/components/glyph-raster";

interface ArticleCoverProps {
  alt: string;
  framesPath: string;
}

export const ArticleCover = component$(
  ({ alt, framesPath }: ArticleCoverProps): QwikJSX.Element => {
    return (
      <div class="article-cover-glyph-raster">
        <GlyphRaster layout="fill" source={{ type: "frames", url: framesPath }} />

        <figure aria-label={alt} role="img" />
      </div>
    );
  },
);
