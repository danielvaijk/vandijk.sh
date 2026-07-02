import { generateGlyphFrameSource, type GlyphFrameSource } from "src/helpers/glyph-frames";
import { join, parse } from "node:path";

const DEFAULT_FRAME_RATE = 18;
const DEFAULT_ROWS = 40;
const DEFAULT_SOURCES = ["src/media/eye.mp4"];

function createGlyphFrameSource(source: string): GlyphFrameSource {
  const { name } = parse(source);

  return {
    fps: DEFAULT_FRAME_RATE,
    output: join("public", `${name}.frames`),
    rows: DEFAULT_ROWS,
    source,
  };
}

const GLYPH_FRAME_SOURCES = (
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_SOURCES
).map(createGlyphFrameSource);

for (const source of GLYPH_FRAME_SOURCES) {
  await generateGlyphFrameSource(source);
}
