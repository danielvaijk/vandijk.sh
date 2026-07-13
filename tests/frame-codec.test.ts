import { describe, expect, test } from "bun:test";

import {
  GLYPH_FRAME_BRIGHTNESS_BITS,
  GLYPH_FRAME_ENCODING,
  GLYPH_FRAME_FORMAT_VERSION,
  decodePredictiveGlyphFrames,
  encodePredictiveGlyphFrames,
  getPackedGlyphFrameSize,
  tryDecodePredictiveGlyphFrame,
  unpackQuantizedGlyphFrame,
} from "src/vfx/glyph-raster/frame-codec";
import { parseSourceHeader } from "src/vfx/glyph-raster/source";

const toBrightness = (frames: number[][]): Uint8Array =>
  Uint8Array.from(frames.flat(), (value): number => value * 17);

function createFramesFile(header: object, payload: Uint8Array): Uint8Array {
  const headerBytes = new TextEncoder().encode(`${JSON.stringify(header)}\n`);
  const file = new Uint8Array(headerBytes.length + payload.length);
  file.set(headerBytes);
  file.set(payload, headerBytes.length);

  return file;
}

describe("predictive glyph frame codec", () => {
  test("round-trips repeat, delta, escape, and full frames", () => {
    const first = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    const repeat = [...first];
    const delta = [...repeat];
    delta[0] += 1;
    delta[1] -= 1;
    delta[2] += 2;
    delta[3] -= 3;
    delta[4] += 8;
    const full = delta.map((value): number => 15 - value);
    const source = toBrightness([first, repeat, delta, full]);
    const encoded = encodePredictiveGlyphFrames(source, first.length);

    expect(encoded.repeatFrameCount).toBe(1);
    expect(encoded.deltaFrameCount).toBe(1);
    expect(encoded.fullFrameCount).toBe(2);
    expect(decodePredictiveGlyphFrames(encoded.payload, first.length, 4)).toEqual(source);
  });

  test("waits for a complete streamed delta chunk", () => {
    const first = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const delta = [...first];
    delta[0] = 1;
    delta[4] = 12;
    const encoded = encodePredictiveGlyphFrames(toBrightness([first, delta]), first.length);
    const keyframeSize = getPackedGlyphFrameSize(first.length);
    const keyframe = unpackQuantizedGlyphFrame(
      encoded.payload.subarray(0, keyframeSize),
      first.length,
    );
    const chunk = encoded.payload.subarray(keyframeSize);

    for (let length = 0; length < chunk.length; length += 1) {
      expect(tryDecodePredictiveGlyphFrame(chunk.subarray(0, length), keyframe)).toBeNull();
    }

    const decoded = tryDecodePredictiveGlyphFrame(chunk, keyframe);
    expect(decoded?.bytesRead).toBe(chunk.length);
    expect(decoded?.frame).toEqual(Uint8Array.from(delta));
  });

  test("quantizes arbitrary bytes to the nearest four-bit brightness", () => {
    const source = Uint8Array.from([0, 8, 16, 24, 127, 128, 246, 255]);
    const encoded = encodePredictiveGlyphFrames(source, source.length);
    const decoded = decodePredictiveGlyphFrames(encoded.payload, source.length, 1);

    expect(decoded).toEqual(Uint8Array.from([0, 0, 17, 17, 119, 136, 238, 255]));
  });

  test("rejects legacy raw frames", () => {
    const frames = Uint8Array.from([0, 64, 128, 255, 255, 128, 64, 0]);
    const header = { cols: 2, fps: 12, n_frames: 2, rows: 2 };

    expect(() => parseSourceHeader(createFramesFile(header, frames), "/legacy.frames")).toThrow(
      "Unsupported character animation frame format",
    );
  });

  test("parses only a complete version-two file", () => {
    const frames = toBrightness([
      [0, 5, 10, 15],
      [1, 5, 9, 15],
    ]);
    const encoded = encodePredictiveGlyphFrames(frames, 4);
    const file = createFramesFile(
      {
        bits: GLYPH_FRAME_BRIGHTNESS_BITS,
        cols: 2,
        encoding: GLYPH_FRAME_ENCODING,
        fps: 12,
        n_frames: 2,
        rows: 2,
        version: GLYPH_FRAME_FORMAT_VERSION,
      },
      encoded.payload,
    );
    const parsed = parseSourceHeader(file, "/predictive.frames");

    expect(parsed.defaultFps).toBe(12);
    expect(parsed.frames).toEqual(frames);

    const fileWithTrailingByte = new Uint8Array(file.length + 1);
    fileWithTrailingByte.set(file);
    expect(() => parseSourceHeader(fileWithTrailingByte, "/predictive.frames")).toThrow(
      "trailing bytes",
    );
  });
});
