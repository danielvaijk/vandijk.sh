import { staticAdapter } from "@builder.io/qwik-city/adapters/static/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import type { UserConfig } from "vite";

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths -- Vite needs relative paths.
import { determineOriginUrl } from "../src/utilities/url";
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths -- Vite needs relative paths.
import baseConfig from "../vite.config";

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
