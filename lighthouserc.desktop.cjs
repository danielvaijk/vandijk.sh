const mobileConfig = require("./lighthouserc.cjs");
const DESKTOP_PORT = process.env.LIGHTHOUSE_DESKTOP_PORT ?? "4174";

module.exports = {
  ci: {
    ...mobileConfig.ci,
    collect: {
      ...mobileConfig.ci.collect,
      additive: true,
      settings: {
        preset: "desktop",
      },
      startServerCommand: `bun scripts/serve-lighthouse.ts --port=${DESKTOP_PORT}`,
      url: mobileConfig.ci.collect.url.map((rawUrl) => {
        const url = new URL(rawUrl);
        url.port = DESKTOP_PORT;
        return url.href;
      }),
    },
  },
};
