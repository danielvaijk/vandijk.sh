interface EncodedPredictiveFrames {
  deltaFrameCount: number;
  fullFrameCount: number;
  payload: Uint8Array;
  repeatFrameCount: number;
}

interface DecodedPredictiveFrame {
  bytesRead: number;
  frame: Uint8Array;
}

const GLYPH_FRAME_FORMAT_VERSION = 2;
const GLYPH_FRAME_BRIGHTNESS_BITS = 4;
const GLYPH_FRAME_ENCODING = "q4-delta";
const GLYPH_FRAME_BRIGHTNESS_MAX = (1 << GLYPH_FRAME_BRIGHTNESS_BITS) - 1;
const GLYPH_FRAME_BRIGHTNESS_STEP = 255 / GLYPH_FRAME_BRIGHTNESS_MAX;
const GLYPH_FRAME_OPCODE_FULL = 0;
const GLYPH_FRAME_OPCODE_DELTA = 1;
const GLYPH_FRAME_OPCODE_REPEAT = 2;

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk): number => total + chunk.length, 0));
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function getPackedGlyphFrameSize(frameSize: number): number {
  return Math.ceil((frameSize * GLYPH_FRAME_BRIGHTNESS_BITS) / 8);
}

function quantizeGlyphFrameBrightness(value: number): number {
  return Math.min(
    GLYPH_FRAME_BRIGHTNESS_MAX,
    Math.max(0, Math.round(value / GLYPH_FRAME_BRIGHTNESS_STEP)),
  );
}

function expandGlyphFrameBrightness(value: number): number {
  return Math.round(value * GLYPH_FRAME_BRIGHTNESS_STEP);
}

function quantizeGlyphFrames(frames: Uint8Array): Uint8Array {
  const quantized = new Uint8Array(frames.length);

  for (let index = 0; index < frames.length; index += 1) {
    quantized[index] = quantizeGlyphFrameBrightness(frames[index]);
  }

  return quantized;
}

function packQuantizedGlyphFrame(frame: Uint8Array): Uint8Array {
  const packed = new Uint8Array(getPackedGlyphFrameSize(frame.length));

  for (let index = 0; index < frame.length; index += 1) {
    const value = frame[index];
    if (value > GLYPH_FRAME_BRIGHTNESS_MAX) {
      throw new Error(`Cannot pack glyph frame brightness value ${value}.`);
    }

    const byteIndex = index >> 1;
    packed[byteIndex] |= index % 2 === 0 ? value : value << GLYPH_FRAME_BRIGHTNESS_BITS;
  }

  return packed;
}

function unpackQuantizedGlyphFrame(packed: Uint8Array, frameSize: number): Uint8Array {
  const packedSize = getPackedGlyphFrameSize(frameSize);
  if (packed.length < packedSize) {
    throw new Error("Packed glyph frame ended before its final brightness value.");
  }

  const frame = new Uint8Array(frameSize);

  for (let index = 0; index < frameSize; index += 1) {
    const packedValue = packed[index >> 1];
    frame[index] =
      index % 2 === 0
        ? packedValue & GLYPH_FRAME_BRIGHTNESS_MAX
        : packedValue >> GLYPH_FRAME_BRIGHTNESS_BITS;
  }

  return frame;
}

function writeBit(target: Uint8Array, bitOffset: number, value: number): number {
  if (value !== 0) {
    target[bitOffset >> 3] |= 1 << (bitOffset & 7);
  }

  return bitOffset + 1;
}

function writeBits(target: Uint8Array, bitOffset: number, value: number, bitCount: number): number {
  for (let bit = 0; bit < bitCount; bit += 1) {
    bitOffset = writeBit(target, bitOffset, (value >> bit) & 1);
  }

  return bitOffset;
}

function getEncodedBrightnessDeltaBitCount(difference: number): number {
  const magnitude = Math.abs(difference);

  if (magnitude === 1) {
    return 2;
  }
  if (magnitude === 2) {
    return 3;
  }
  if (magnitude === 3) {
    return 4;
  }

  return 3 + GLYPH_FRAME_BRIGHTNESS_BITS;
}

function writeEncodedBrightnessDelta(
  target: Uint8Array,
  bitOffset: number,
  difference: number,
  nextValue: number,
): number {
  const magnitude = Math.abs(difference);

  if (magnitude === 1) {
    bitOffset = writeBit(target, bitOffset, 0);
    return writeBit(target, bitOffset, difference > 0 ? 1 : 0);
  }

  bitOffset = writeBit(target, bitOffset, 1);
  if (magnitude === 2) {
    bitOffset = writeBit(target, bitOffset, 0);
    return writeBit(target, bitOffset, difference > 0 ? 1 : 0);
  }

  bitOffset = writeBit(target, bitOffset, 1);
  if (magnitude === 3) {
    bitOffset = writeBit(target, bitOffset, 0);
    return writeBit(target, bitOffset, difference > 0 ? 1 : 0);
  }

  bitOffset = writeBit(target, bitOffset, 1);
  return writeBits(target, bitOffset, nextValue, GLYPH_FRAME_BRIGHTNESS_BITS);
}

function createPredictiveDeltaChunk(
  previousFrame: Uint8Array,
  nextFrame: Uint8Array,
): Uint8Array | null {
  if (previousFrame.length !== nextFrame.length) {
    throw new Error("Predictive glyph frames must have matching dimensions.");
  }

  const mask = new Uint8Array(Math.ceil(nextFrame.length / 8));
  let bitCount = 0;
  let changedCount = 0;

  for (let index = 0; index < nextFrame.length; index += 1) {
    const difference = nextFrame[index] - previousFrame[index];
    if (difference === 0) {
      continue;
    }

    mask[index >> 3] |= 1 << (index & 7);
    bitCount += getEncodedBrightnessDeltaBitCount(difference);
    changedCount += 1;
  }

  if (changedCount === 0) {
    return null;
  }

  const deltas = new Uint8Array(Math.ceil(bitCount / 8));
  let bitOffset = 0;

  for (let index = 0; index < nextFrame.length; index += 1) {
    const difference = nextFrame[index] - previousFrame[index];
    if (difference !== 0) {
      bitOffset = writeEncodedBrightnessDelta(deltas, bitOffset, difference, nextFrame[index]);
    }
  }

  return concatBytes([Uint8Array.of(GLYPH_FRAME_OPCODE_DELTA), mask, deltas]);
}

function encodePredictiveGlyphFrames(
  frames: Uint8Array,
  frameSize: number,
): EncodedPredictiveFrames {
  if (frameSize <= 0 || frames.length === 0 || frames.length % frameSize !== 0) {
    throw new Error(`Cannot encode ${frames.length} glyph frame bytes at frame size ${frameSize}.`);
  }

  const quantizedFrames = quantizeGlyphFrames(frames);
  const frameCount = quantizedFrames.length / frameSize;
  const chunks = [packQuantizedGlyphFrame(quantizedFrames.subarray(0, frameSize))];
  const packedFrameSize = getPackedGlyphFrameSize(frameSize);
  let deltaFrameCount = 0;
  let fullFrameCount = 1;
  let repeatFrameCount = 0;

  for (let frame = 1; frame < frameCount; frame += 1) {
    const frameOffset = frame * frameSize;
    const previousFrame = quantizedFrames.subarray(frameOffset - frameSize, frameOffset);
    const nextFrame = quantizedFrames.subarray(frameOffset, frameOffset + frameSize);
    const deltaChunk = createPredictiveDeltaChunk(previousFrame, nextFrame);

    if (!deltaChunk) {
      chunks.push(Uint8Array.of(GLYPH_FRAME_OPCODE_REPEAT));
      repeatFrameCount += 1;
    } else if (deltaChunk.length < 1 + packedFrameSize) {
      chunks.push(deltaChunk);
      deltaFrameCount += 1;
    } else {
      chunks.push(Uint8Array.of(GLYPH_FRAME_OPCODE_FULL), packQuantizedGlyphFrame(nextFrame));
      fullFrameCount += 1;
    }
  }

  return {
    deltaFrameCount,
    fullFrameCount,
    payload: concatBytes(chunks),
    repeatFrameCount,
  };
}

function readBit(source: Uint8Array, bitOffset: number): number | null {
  const byteIndex = bitOffset >> 3;
  if (byteIndex >= source.length) {
    return null;
  }

  return (source[byteIndex] >> (bitOffset & 7)) & 1;
}

function readBits(source: Uint8Array, bitOffset: number, bitCount: number): number | null {
  let value = 0;

  for (let bit = 0; bit < bitCount; bit += 1) {
    const next = readBit(source, bitOffset + bit);
    if (next === null) {
      return null;
    }
    value |= next << bit;
  }

  return value;
}

function tryDecodePredictiveGlyphFrame(
  source: Uint8Array,
  previousFrame: Uint8Array,
): DecodedPredictiveFrame | null {
  if (source.length === 0) {
    return null;
  }

  const opcode = source[0];
  if (opcode === GLYPH_FRAME_OPCODE_REPEAT) {
    return { bytesRead: 1, frame: previousFrame.slice() };
  }

  if (opcode === GLYPH_FRAME_OPCODE_FULL) {
    const packedSize = getPackedGlyphFrameSize(previousFrame.length);
    if (source.length < 1 + packedSize) {
      return null;
    }

    return {
      bytesRead: 1 + packedSize,
      frame: unpackQuantizedGlyphFrame(source.subarray(1, 1 + packedSize), previousFrame.length),
    };
  }

  if (opcode !== GLYPH_FRAME_OPCODE_DELTA) {
    throw new Error(`Unknown predictive glyph frame opcode ${opcode}.`);
  }

  const maskSize = Math.ceil(previousFrame.length / 8);
  if (source.length < 1 + maskSize) {
    return null;
  }

  const mask = source.subarray(1, 1 + maskSize);
  const deltas = source.subarray(1 + maskSize);
  const frame = previousFrame.slice();
  let bitOffset = 0;

  for (let index = 0; index < frame.length; index += 1) {
    if ((mask[index >> 3] & (1 << (index & 7))) === 0) {
      continue;
    }

    const first = readBit(deltas, bitOffset);
    if (first === null) {
      return null;
    }
    bitOffset += 1;

    let nextValue: number;
    if (first === 0) {
      const sign = readBit(deltas, bitOffset);
      if (sign === null) {
        return null;
      }
      bitOffset += 1;
      nextValue = frame[index] + (sign === 1 ? 1 : -1);
    } else {
      const second = readBit(deltas, bitOffset);
      if (second === null) {
        return null;
      }
      bitOffset += 1;

      if (second === 0) {
        const sign = readBit(deltas, bitOffset);
        if (sign === null) {
          return null;
        }
        bitOffset += 1;
        nextValue = frame[index] + (sign === 1 ? 2 : -2);
      } else {
        const third = readBit(deltas, bitOffset);
        if (third === null) {
          return null;
        }
        bitOffset += 1;

        if (third === 0) {
          const sign = readBit(deltas, bitOffset);
          if (sign === null) {
            return null;
          }
          bitOffset += 1;
          nextValue = frame[index] + (sign === 1 ? 3 : -3);
        } else {
          const absolute = readBits(deltas, bitOffset, GLYPH_FRAME_BRIGHTNESS_BITS);
          if (absolute === null) {
            return null;
          }
          bitOffset += GLYPH_FRAME_BRIGHTNESS_BITS;
          nextValue = absolute;
        }
      }
    }

    if (nextValue < 0 || nextValue > GLYPH_FRAME_BRIGHTNESS_MAX) {
      throw new Error(`Predictive glyph frame produced brightness value ${nextValue}.`);
    }
    frame[index] = nextValue;
  }

  return {
    bytesRead: 1 + maskSize + Math.ceil(bitOffset / 8),
    frame,
  };
}

function expandQuantizedGlyphFrame(frame: Uint8Array): Uint8Array {
  const brightness = new Uint8Array(frame.length);

  for (let index = 0; index < frame.length; index += 1) {
    brightness[index] = expandGlyphFrameBrightness(frame[index]);
  }

  return brightness;
}

function decodePredictiveGlyphFrames(
  payload: Uint8Array,
  frameSize: number,
  frameCount: number,
): Uint8Array {
  if (frameSize <= 0 || frameCount <= 0) {
    throw new Error(`Cannot decode ${frameCount} predictive glyph frames at size ${frameSize}.`);
  }

  const packedFrameSize = getPackedGlyphFrameSize(frameSize);
  if (payload.length < packedFrameSize) {
    throw new Error("Predictive glyph frame keyframe is incomplete.");
  }

  const frames = new Uint8Array(frameSize * frameCount);
  let quantizedFrame = unpackQuantizedGlyphFrame(payload.subarray(0, packedFrameSize), frameSize);
  frames.set(expandQuantizedGlyphFrame(quantizedFrame), 0);
  let offset = packedFrameSize;

  for (let frame = 1; frame < frameCount; frame += 1) {
    const decoded = tryDecodePredictiveGlyphFrame(payload.subarray(offset), quantizedFrame);
    if (!decoded) {
      throw new Error(`Predictive glyph frame ${frame} is incomplete.`);
    }

    quantizedFrame = decoded.frame;
    frames.set(expandQuantizedGlyphFrame(quantizedFrame), frame * frameSize);
    offset += decoded.bytesRead;
  }

  if (offset !== payload.length) {
    throw new Error(
      `Predictive glyph frame payload has ${payload.length - offset} trailing bytes.`,
    );
  }

  return frames;
}

export {
  GLYPH_FRAME_BRIGHTNESS_BITS,
  GLYPH_FRAME_ENCODING,
  GLYPH_FRAME_FORMAT_VERSION,
  decodePredictiveGlyphFrames,
  encodePredictiveGlyphFrames,
  expandQuantizedGlyphFrame,
  getPackedGlyphFrameSize,
  tryDecodePredictiveGlyphFrame,
  unpackQuantizedGlyphFrame,
};

export type { DecodedPredictiveFrame, EncodedPredictiveFrames };
