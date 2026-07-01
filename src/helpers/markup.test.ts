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
  ["Before.", "", '<ArticleCodeDrawer label={"TSX"} src={""} />', "", "After."].join("\n"),
);

const markdownWithPlainCodeBlock = ["~~~~", "plain text", "~~~~"].join("\n");

assert.equal(
  await wrapMarkdownCodeBlocks(markdownWithPlainCodeBlock),
  '<ArticleCodeDrawer label={"Code"} src={""} />',
);

const markdownWithUnformattedCodeBlock = [
  "```ts",
  "const value = someFunction(alpha, beta, gamma, delta, epsilon, zeta, eta, theta);",
  "```",
].join("\n");

assert.equal(
  await wrapMarkdownCodeBlocks(markdownWithUnformattedCodeBlock),
  '<ArticleCodeDrawer label={"TS"} src={""} />',
);

const savedCodeBlocks = new Array<string>();

assert.equal(
  await wrapMarkdownCodeBlocks(markdownWithUnformattedCodeBlock, {
    saveCodeBlockContent: async ({ html }): Promise<string> => {
      savedCodeBlocks.push(html);
      return "/assets/example.code.html";
    },
  }),
  '<ArticleCodeDrawer label={"TS"} src={"/assets/example.code.html"} />',
);
assert.deepEqual(savedCodeBlocks, [
  [
    '<pre><code class="language-ts"><span class="token keyword">const</span> value <span class="token operator">=</span> <span class="token function">someFunction</span><span class="token punctuation">(</span>',
    '  alpha<span class="token punctuation">,</span>',
    '  beta<span class="token punctuation">,</span>',
    '  gamma<span class="token punctuation">,</span>',
    '  delta<span class="token punctuation">,</span>',
    '  epsilon<span class="token punctuation">,</span>',
    '  zeta<span class="token punctuation">,</span>',
    '  eta<span class="token punctuation">,</span>',
    '  theta<span class="token punctuation">,</span>',
    '<span class="token punctuation">)</span><span class="token punctuation">;</span></code></pre>',
  ].join("\n"),
]);
