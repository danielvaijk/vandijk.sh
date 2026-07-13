import { describe, expect, test } from "bun:test";

import { createAssetContentHash } from "../plugins/asset-content-hash";

describe("asset content hashes", () => {
  test("uses the first 64 bits of a SHA-256 digest", () => {
    expect(createAssetContentHash("abc")).toBe("ba7816bf8f01cfea");
  });

  test("returns the same hash for identical binary content", () => {
    const content = new Uint8Array([0, 1, 2, 3]);

    expect(createAssetContentHash(content)).toBe(createAssetContentHash(content));
  });
});
