import assert from "node:assert/strict";

import {
  getMarkdownProseWordCount,
  getReadTimeInMinutesFromWordCount,
  getWordCount,
} from "src/utilities/text";

assert.equal(getWordCount("one  two\nthree"), 3);
assert.equal(getWordCount("  \n\t  "), 0);

const markdownWithBacktickCodeFence = [
  "This prose counts.",
  "",
  "```ts",
  "const codeWords = 'should not count';",
  "function example() {",
  "  return codeWords;",
  "}",
  "```",
  "",
  "This also counts.",
].join("\n");

assert.equal(getMarkdownProseWordCount(markdownWithBacktickCodeFence), 6);

const markdownWithTildeCodeFence = ["Visible words.", "", "~~~~", "ignored words", "~~~~"].join(
  "\n",
);

assert.equal(getMarkdownProseWordCount(markdownWithTildeCodeFence), 2);
assert.equal(getReadTimeInMinutesFromWordCount(201), 2);
