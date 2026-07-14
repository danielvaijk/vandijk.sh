const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const DIST_DIRECTORY = join(__dirname, "dist");
const SITEMAP_PATH = join(DIST_DIRECTORY, "sitemap.xml");

function findChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  return [
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
    return `http://localhost${pathname}${search}`;
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
        preset: "desktop",
      },
      staticDistDir: DIST_DIRECTORY,
      url: discoverPageUrls(),
    },
    assert: {
      aggregationMethod: "pessimistic",
      assertions: {
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:performance": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
      preset: "lighthouse:all",
    },
  },
};
