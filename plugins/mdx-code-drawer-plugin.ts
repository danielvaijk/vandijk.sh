import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

import { wrapMarkdownCodeBlocks } from "../src/helpers/markup";
import {
  getMarkdownProseWordCount,
  getReadTimeInMinutesFromWordCount,
  stripMarkdownCodeBlocks,
} from "../src/utilities/text";
import { formatDateAsString } from "../src/utilities/time";

const ARTICLE_CODE_DRAWER_IMPORT =
  'import { ArticleCodeDrawer } from "src/components/article-code-drawer";';
const ARTICLES_PUBLIC_DIRECTORY = "./public/blog";
const MARKDOWN_CODE_BLOCK_REGEX =
  /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/u;

interface ArticleFrontmatter {
  date?: string;
  title?: string;
  topic?: string;
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/[^\w\\-]+/gu, "")
    .replace(/\\-\\-+/gu, "-");
}

function cleanGeneratedArticleCodeBlocks(directory = ARTICLES_PUBLIC_DIRECTORY): void {
  if (!existsSync(directory)) {
    return;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      cleanGeneratedArticleCodeBlocks(entryPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".code.html")) {
      rmSync(entryPath, { force: true });
    }
  }
}

function saveArticleCodeBlock(html: string, articlePath: string): string {
  const contentHash = createHash("sha256").update(html).digest("hex");
  const fileName = `${contentHash}.code.html`;
  const outputDirectory = join(ARTICLES_PUBLIC_DIRECTORY, articlePath);

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, fileName), html);

  return `/blog/${articlePath}/${fileName}`;
}

function parseFrontmatter(source: string): { body: string; frontmatter: ArticleFrontmatter } {
  const match = /^---\n(?<frontmatter>[\s\S]*?)\n---\n?(?<body>[\s\S]*)$/u.exec(source);

  if (match?.groups === undefined) {
    return { body: source, frontmatter: {} };
  }

  const data: Record<string, string> = {};

  for (const line of match.groups.frontmatter.split("\n")) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  }

  return { body: match.groups.body, frontmatter: data };
}

function getAnchorLinks(content: string): string {
  return stripMarkdownCodeBlocks(content)
    .split("\n")
    .flatMap((line: string): Array<string> => {
      const match = /^(?<level>#{2,3})\s+(?<title>.+)$/u.exec(line);

      if (match?.groups === undefined) {
        return [];
      }

      const indent = match.groups.level.length === 3 ? "  " : "";
      const title = match.groups.title.replace(/\s+#$/u, "").trim();

      return [`${indent}- [${title}](#${slugify(title)})`];
    })
    .join("\n");
}

function createArticleContentsBlock({
  articleContent,
  date,
  topic,
}: {
  articleContent: string;
  date: Date;
  topic: string;
}): string {
  const readTime = getReadTimeInMinutesFromWordCount(getMarkdownProseWordCount(articleContent));
  const anchorLinks = getAnchorLinks(articleContent);

  return `<time dateTime="${date.toISOString()}" role="doc-subtitle">
  ${formatDateAsString(date)}
</time>

---

## Contents

A ~${readTime} min read on ${topic}.

${anchorLinks}

---`;
}

function addArticleContents(source: string): string {
  if (/^##\s+Contents\s*$/mu.test(stripMarkdownCodeBlocks(source))) {
    return source;
  }

  const { body, frontmatter } = parseFrontmatter(source);

  if (
    typeof frontmatter.date !== "string" ||
    typeof frontmatter.topic !== "string" ||
    Number.isNaN(new Date(frontmatter.date).getTime())
  ) {
    return source;
  }

  const title = frontmatter.title;
  const titlePattern =
    typeof title === "string" && title.length > 0
      ? new RegExp(`^#\\s+${title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*$`, "mu")
      : /^#\s+.+$/mu;
  const titleMatch = titlePattern.exec(body);

  if (titleMatch === null || typeof titleMatch.index !== "number") {
    return source;
  }

  const titleEndIndex = titleMatch.index + titleMatch[0].length;
  const articleContent = body.slice(titleEndIndex).trim();
  const contentsBlock = createArticleContentsBlock({
    articleContent,
    date: new Date(frontmatter.date),
    topic: frontmatter.topic,
  });
  const bodyWithContents = `${body.slice(0, titleEndIndex)}\n\n${contentsBlock}\n\n${body
    .slice(titleEndIndex)
    .trimStart()}`;

  return source.slice(0, source.length - body.length) + bodyWithContents;
}

function addArticleCodeDrawerImport(source: string): string {
  if (source.includes(ARTICLE_CODE_DRAWER_IMPORT)) {
    return source;
  }

  const frontmatterMatch = /^---\n[\s\S]*?\n---\n?/u.exec(source);

  if (frontmatterMatch === null) {
    return `${ARTICLE_CODE_DRAWER_IMPORT}\n\n${source}`;
  }

  return `${frontmatterMatch[0]}\n${ARTICLE_CODE_DRAWER_IMPORT}\n${source.slice(
    frontmatterMatch[0].length,
  )}`;
}

function getBlogArticlePath(id: string): string | null {
  return /\/src\/routes\/blog\/(?<path>[^/]+)\/index\.mdx(?:\?|$)/u.exec(id)?.groups?.path ?? null;
}

function articleCodeDrawerMdxPlugin(): Plugin {
  return {
    name: "article-code-drawer-mdx",
    enforce: "pre",
    buildStart(): void {
      cleanGeneratedArticleCodeBlocks();
    },
    async transform(source, id): Promise<string | null> {
      const articlePath = getBlogArticlePath(id);

      if (articlePath === null) {
        return null;
      }

      const markdownWithArticleContents = addArticleContents(source);

      if (!MARKDOWN_CODE_BLOCK_REGEX.test(markdownWithArticleContents)) {
        return markdownWithArticleContents;
      }

      const markdownWithCodeDrawers = await wrapMarkdownCodeBlocks(markdownWithArticleContents, {
        saveCodeBlockContent: async ({ html }: { html: string }): Promise<string> =>
          saveArticleCodeBlock(html, articlePath),
      });

      return addArticleCodeDrawerImport(markdownWithCodeDrawers);
    },
  };
}

export { articleCodeDrawerMdxPlugin };
