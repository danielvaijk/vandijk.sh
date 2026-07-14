import { describe, expect, test } from "bun:test";

import { applyCloudflareHeaders, parseCloudflareHeaders } from "../scripts/cloudflare-headers";

describe("Cloudflare header rules", () => {
  test("applies global and asset-specific rules over platform defaults", () => {
    const rules = parseCloudflareHeaders(`
/*
  Cross-Origin-Opener-Policy: same-origin
  Referrer-Policy: no-referrer

/*.frames
  Cache-Control: public, max-age=31536000, immutable
`);
    const headers = applyCloudflareHeaders(rules, "/nested/animation.frames", {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });

    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  test("joins repeated custom headers and supports detaching them", () => {
    const rules = parseCloudflareHeaders(`
/*
  X-Robots-Tag: noindex

/public/*
  X-Robots-Tag: noarchive

/public/private/*
  ! X-Robots-Tag
`);

    expect(applyCloudflareHeaders(rules, "/public/page").get("X-Robots-Tag")).toBe(
      "noindex, noarchive",
    );
    expect(applyCloudflareHeaders(rules, "/public/private/page").has("X-Robots-Tag")).toBe(false);
  });

  test("rejects unsupported rules instead of silently serving the wrong headers", () => {
    expect(() => parseCloudflareHeaders("https://example.com/*\n  X-Test: value")).toThrow(
      "Only path-based",
    );
    expect(() => parseCloudflareHeaders("/users/:id\n  X-Test: value")).toThrow(
      "placeholders are not supported",
    );
  });
});
