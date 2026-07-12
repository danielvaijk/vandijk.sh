import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { articleCodeDrawerMdxPlugin } from "./src/scripts/mdx-code-drawer-plugin";

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
      articleCodeDrawerMdxPlugin(),
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
