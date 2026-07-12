import { staticAdapter } from "@builder.io/qwik-city/adapters/static/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import { env } from "node:process";
import type { UserConfig } from "vite";
import baseConfig from "../vite.config";

function determineOriginUrl(): string {
  const { CF_PAGES_BRANCH, CF_PAGES_URL, PREVIEW_BUILD } = env;

  if (CF_PAGES_BRANCH === "main") {
    return "https://daniel.vandijk.sh";
  } else if (typeof CF_PAGES_URL !== "undefined") {
    return CF_PAGES_URL;
  } else if (typeof PREVIEW_BUILD !== "undefined") {
    return "http://localhost:4173";
  }
  return "http://localhost:5173";
}

export default extendConfig(
  baseConfig,
  (): UserConfig => ({
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
  }),
);
