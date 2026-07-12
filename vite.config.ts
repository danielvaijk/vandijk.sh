import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { articlePlugin } from "./plugins/article";
import { glyperPlugin } from "./plugins/glypher";
import { imagePlugin } from "./plugins/image";

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
      imagePlugin(),
      articlePlugin(),
      glyperPlugin(),
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
