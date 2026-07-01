import assert from "node:assert/strict";

import { wrapMarkdownCodeBlocks } from "src/helpers/markup";

const markdownWithCodeBlock = [
  "Before.",
  "",
  "```tsx",
  "const value = true;",
  "```",
  "",
  "After.",
].join("\n");

assert.equal(
  await wrapMarkdownCodeBlocks(markdownWithCodeBlock),
  [
    "Before.",
    "",
    '<details class="article-code-drawer">',
    "<summary>TSX</summary>",
    "",
    "```tsx",
    "const value = true;",
    "```",
    "",
    "</details>",
    "",
    "After.",
  ].join("\n"),
);

const markdownWithPlainCodeBlock = ["~~~~", "plain text", "~~~~"].join("\n");

assert.equal(
  await wrapMarkdownCodeBlocks(markdownWithPlainCodeBlock),
  [
    '<details class="article-code-drawer">',
    "<summary>Code</summary>",
    "",
    "~~~~",
    "plain text",
    "~~~~",
    "",
    "</details>",
  ].join("\n"),
);

const markdownWithUnformattedCodeBlock = [
  "```ts",
  "const value = someFunction(alpha, beta, gamma, delta, epsilon, zeta, eta, theta);",
  "```",
].join("\n");

assert.equal(
  await wrapMarkdownCodeBlocks(markdownWithUnformattedCodeBlock),
  [
    '<details class="article-code-drawer">',
    "<summary>TS</summary>",
    "",
    "```ts",
    "const value = someFunction(",
    "  alpha,",
    "  beta,",
    "  gamma,",
    "  delta,",
    "  epsilon,",
    "  zeta,",
    "  eta,",
    "  theta,",
    ");",
    "```",
    "",
    "</details>",
  ].join("\n"),
);
