import { describe, expect, test } from "bun:test";

import { addArticleContents } from "../plugins/article-content-renderer";

describe("article contents renderer", () => {
  test("ignores contents headings inside every fenced code block", () => {
    const source = `---
title: "Example Article"
date: "2026-07-14T00:00:00.000Z"
topic: "Testing"
---

# Example Article

## First section

\`\`\`ts
const example = true;
\`\`\`

\`\`\`mdx
## Contents
\`\`\`

## Last section
`;

    const result = addArticleContents(source);

    expect(result.match(/^## Contents$/gmu)).toHaveLength(2);
    expect(result).toContain("[First section](#first-section)");
    expect(result).toContain("[Last section](#last-section)");
  });
});
