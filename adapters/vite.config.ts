import { staticAdapter } from "@builder.io/qwik-city/adapters/static/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import type { UserConfig } from "vite";

import { determineOriginUrl } from "src/utilities/url";
import baseConfig from "vite.config";

export default extendConfig(baseConfig, (): UserConfig => {
  return {
    build: {
      rollupOptions: {
        input: "@qwik-city-plan",
      },
      ssr: true,
    },
    plugins: [
      staticAdapter({
        origin: determineOriginUrl(),
      }),
    ],
  };
});
