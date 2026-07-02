import { generateGlyphFrameSource, type GlyphFrameSource } from "src/helpers/glyph-frames";

const GLYPH_FRAME_SOURCES: Array<GlyphFrameSource> = [
  {
    fps: 18,
    output: "public/terminal-splash.frames",
    rows: 40,
    source: "src/media/eye.mp4",
  },
];

for (const source of GLYPH_FRAME_SOURCES) {
  await generateGlyphFrameSource(source);
}
