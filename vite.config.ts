import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    plugins: [
      qwikCity({
        mdxPlugins: {
          remarkGfm: false,
          rehypeSyntaxHighlight: true,
          rehypeAutolinkHeadings: false,
        },
      }),
      qwikVite(),
      tsconfigPaths(),
    ],
  };
});
