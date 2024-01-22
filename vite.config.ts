import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { staticAdapter } from "@builder.io/qwik-city/adapters/static/vite";

import { determineOriginUrl } from "./src/utilities/url";

export default defineConfig(() => {
  return {
    build: {
      ssr: true,
      rollupOptions: {
        input: "@qwik-city-plan",
      },
    },
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
      staticAdapter({
        origin: determineOriginUrl(),
      }),
    ],
  };
});
