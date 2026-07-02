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

const markdownWithInlineCode = "This `inline code should count` with prose.";

assert.equal(getMarkdownProseWordCount(markdownWithInlineCode), 7);

const markdownWithTildeCodeFence = ["Visible words.", "", "~~~~", "ignored words", "~~~~"].join(
  "\n",
);

assert.equal(getMarkdownProseWordCount(markdownWithTildeCodeFence), 2);

const markdownWithNestedBackticksInCodeFence = [
  "Count this prose.",
  "",
  "````tsx",
  'const nestedFence = "```";',
  "const ignoredWords = 'should not count';",
  "````",
  "",
  "And this prose.",
].join("\n");

assert.equal(getMarkdownProseWordCount(markdownWithNestedBackticksInCodeFence), 6);

const markdownWithMdxScaffolding = [
  "---",
  "title: Ignored Frontmatter",
  "---",
  "",
  'import { Component } from "src/component";',
  "",
  "export default function Layout({ children: content }) {",
  "  return <article>{content}</article>;",
  "}",
  "",
  "<Component",
  '  label="ignored words"',
  "/>",
  "",
  "# Counted Heading",
  "",
  "Paragraph with `inline code` and [linked text](https://example.com/ignored-url).",
  "",
  "- First list item",
  "1. Second list item",
  "> Quoted words count.",
  "",
  "![Ignored image alt](https://example.com/image.png)",
  "{ignoredExpression}",
].join("\n");

assert.equal(getMarkdownProseWordCount(markdownWithMdxScaffolding), 18);
assert.equal(getReadTimeInMinutesFromWordCount(201), 2);
