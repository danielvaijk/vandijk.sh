import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { articleContentRendererPlugin } from "./plugins/article-content-renderer";
import { frameGreyscaleSamplerPlugin } from "./plugins/frame-greyscale-sampler";
import { imageOptimizerPlugin } from "./plugins/image-optimizer";
import { GLYPH_RASTER_FRAME_OPTIONS } from "./src/vfx/glyph-raster/frame-options";

export default defineConfig((): UserConfig => {
  return {
    css: {
      transformer: "lightningcss",
      lightningcss: {
        drafts: {
          customMedia: true,
        },
      },
    },
    build: {
      cssMinify: "lightningcss",
    },
    plugins: [
      imageOptimizerPlugin(),
      articleContentRendererPlugin(GLYPH_RASTER_FRAME_OPTIONS),
      frameGreyscaleSamplerPlugin(GLYPH_RASTER_FRAME_OPTIONS),
      qwikCity({
        mdxPlugins: {
          rehypeAutolinkHeadings: false,
          rehypeSyntaxHighlight: true,
          remarkGfm: false,
        },
      }),
      qwikVite(),
      tsconfigPaths(),
    ],
  };
});
