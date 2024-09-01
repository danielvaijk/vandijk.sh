// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

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
