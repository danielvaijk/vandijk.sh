import { describe, expect, test } from "bun:test";

import { snapGlyphFieldModifierBounds } from "src/vfx/glyph-raster/logic";

describe("glyph field grid alignment", () => {
  test("snaps a fractional desktop modifier to its selected glyph envelope", () => {
    expect(
      snapGlyphFieldModifierBounds(
        {
          documentLeft: 394.5,
          documentTop: 207.96875,
          height: 328.6875,
          width: 576,
        },
        { cellHeight: 14, cellWidth: 8, originX: 0, originY: 0 },
      ),
    ).toEqual({
      documentLeft: 392,
      documentTop: 210,
      height: 322,
      width: 576,
    });
  });

  test("snaps fractional mobile cells without introducing drift", () => {
    expect(
      snapGlyphFieldModifierBounds(
        {
          documentLeft: 12.796875,
          documentTop: 256.703125,
          height: 210.71875,
          width: 364.40625,
        },
        {
          cellHeight: 11.1875,
          cellWidth: 6.390625,
          originX: 0,
          originY: 0,
        },
      ),
    ).toEqual({
      documentLeft: 12.78125,
      documentTop: 257.3125,
      height: 212.5625,
      width: 364.265625,
    });
  });

  test("preserves aligned bounds across a document-space grid origin", () => {
    expect(
      snapGlyphFieldModifierBounds(
        {
          documentLeft: 312,
          documentTop: 1442,
          height: 504,
          width: 736,
        },
        { cellHeight: 14, cellWidth: 8, originX: 0, originY: 700 },
      ),
    ).toEqual({
      documentLeft: 312,
      documentTop: 1442,
      height: 504,
      width: 736,
    });
  });
});
