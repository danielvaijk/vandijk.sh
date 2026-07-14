const { existsSync, readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

const DIST_DIRECTORY = join(__dirname, "dist");
const SITEMAP_PATH = join(DIST_DIRECTORY, "sitemap.xml");
const LIGHTHOUSE_HOST = process.env.LIGHTHOUSE_HOST ?? "127.0.0.1";
const LIGHTHOUSE_PORT = process.env.LIGHTHOUSE_PORT ?? "4173";
const LIGHTHOUSE_ORIGIN = `http://${LIGHTHOUSE_HOST}:${LIGHTHOUSE_PORT}`;

function findChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    join(homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    join(homedir(), "Applications/Chromium.app/Contents/MacOS/Chromium"),
    "/opt/homebrew/bin/chromium",
    "/usr/local/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ].find(existsSync);
}

function discoverPageUrls() {
  const sitemap = readFileSync(SITEMAP_PATH, "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => {
    const { pathname, search } = new URL(match[1]);
    return new URL(`${pathname}${search}`, LIGHTHOUSE_ORIGIN).href;
  });

  if (urls.length === 0) {
    throw new Error(`No page URLs found in ${SITEMAP_PATH}.`);
  }

  return urls;
}

module.exports = {
  ci: {
    collect: {
      chromePath: findChromePath(),
      headful: false,
      numberOfRuns: 1,
      settings: {
        formFactor: "mobile",
      },
      startServerCommand: "bun scripts/serve-lighthouse.ts",
      startServerReadyPattern: "Lighthouse server ready",
      url: discoverPageUrls(),
    },
    assert: {
      aggregationMethod: "pessimistic",
      assertions: {
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:performance": ["error", { minScore: 0.99 }],
        "categories:seo": ["error", { minScore: 1 }],
        "csp-xss": ["error", { maxLength: 0 }],
        "network-dependency-tree-insight": ["off", {}],
        "origin-isolation": ["error", { maxLength: 0 }],
      },
      preset: "lighthouse:all",
    },
  },
};
