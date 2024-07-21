import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig((): UserConfig => {
  return {
    plugins: [
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
