import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

const WORLD_MAP_PATH =
  "src/routes/blog/why-and-how-i-built-the-blog-youre-reading/assets/world-map.svg";

describe("world map asset", () => {
  test("renders the land and dots without relying on embedded styles", () => {
    const source = readFileSync(WORLD_MAP_PATH, "utf8");

    expect(source).toMatch(/^<svg\b[^>]*\bfill="#fff"/u);
    expect(source).toMatch(/<path\b[^>]*\bfill-opacity="\.12"/u);
    expect(source.match(/<circle\b/gu)?.length).toBeGreaterThan(0);
  });
});
