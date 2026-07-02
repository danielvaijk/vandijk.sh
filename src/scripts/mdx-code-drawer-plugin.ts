import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { format } from "oxfmt";
import { refractor } from "refractor";
import tsx from "refractor/tsx";
import { toHtml } from "hast-util-to-html";
import type { Plugin } from "vite";

const ARTICLE_CODE_DRAWER_IMPORT =
  'import { ArticleCodeDrawer } from "src/components/articles/article-code-drawer";';
const ASSETS_DIRECTORY = "./public/assets";
const CODE_BLOCK_PRINT_WIDTH = 80;
const WORDS_PER_MINUTE = 200;
const CODE_BLOCK_LANGUAGE_FILE_EXTENSIONS: Record<string, string> = {
  css: "css",
  html: "html",
  javascript: "js",
  js: "js",
  json: "json",
  json5: "json5",
  jsonc: "jsonc",
  jsx: "jsx",
  markdown: "md",
  md: "md",
  mdx: "mdx",
  mjs: "mjs",
  scss: "scss",
  ts: "ts",
  tsx: "tsx",
  typescript: "ts",
  yaml: "yaml",
  yml: "yaml",
};

refractor.register(tsx);

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

function formatDateAsString(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function cleanGeneratedArticleCodeBlocks(): void {
  if (!existsSync(ASSETS_DIRECTORY)) {
    return;
  }

  for (const entry of readdirSync(ASSETS_DIRECTORY, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".code.html")) {
      rmSync(join(ASSETS_DIRECTORY, entry.name), { force: true });
    }
  }
}

function saveArticleCodeBlock(html: string): string {
  const contentHash = createHash("sha256").update(html).digest("hex");
  const fileName = `${contentHash}.code.html`;

  mkdirSync(ASSETS_DIRECTORY, { recursive: true });
  writeFileSync(join(ASSETS_DIRECTORY, fileName), html);

  return `/assets/${fileName}`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
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

function stripMarkdownCodeBlocks(markdown: string): string {
  return markdown.replace(
    /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/gu,
    "$1",
  );
}

function getMarkdownProseWordCount(markdown: string): number {
  const prose = stripMarkdownCodeBlocks(markdown).trim();

  if (prose.length === 0) {
    return 0;
  }

  return prose.split(/\s+/u).length;
}

function getReadTimeInMinutes(markdown: string): number {
  return Math.ceil(getMarkdownProseWordCount(markdown) / WORDS_PER_MINUTE);
}

function getAnchorLinks(content: string): string {
  return stripMarkdownCodeBlocks(content)
    .split("\n")
    .flatMap((line): Array<string> => {
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
  const readTime = getReadTimeInMinutes(articleContent);
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

function getCodeBlockLanguage(info: string): string | null {
  const language = info.trim().split(/\s+/u)[0]?.toLowerCase();

  if (typeof language !== "string" || language.length === 0) {
    return null;
  }

  return language;
}

function getCodeDrawerSummary(info: string): string {
  return getCodeBlockLanguage(info)?.toUpperCase() ?? "Code";
}

function getCodeBlockFileName(info: string): string | null {
  const language = getCodeBlockLanguage(info);

  if (language === null) {
    return null;
  }

  const extension = CODE_BLOCK_LANGUAGE_FILE_EXTENSIONS[language];

  if (typeof extension !== "string") {
    return null;
  }

  return `article-code-block.${extension}`;
}

async function formatMarkdownCodeBlock(code: string, info: string): Promise<string> {
  const fileName = getCodeBlockFileName(info);

  if (fileName === null) {
    return code;
  }

  const result = await format(fileName, `${code}\n`, {
    printWidth: CODE_BLOCK_PRINT_WIDTH,
  });

  if (result.errors.length > 0) {
    return code;
  }

  return result.code.replace(/\n$/u, "");
}

function renderCodeBlockHtml(code: string, info: string): string {
  const language = getCodeBlockLanguage(info);
  const languageClass = language === null ? "" : ` class="language-${escapeHtmlText(language)}"`;
  let codeHtml = escapeHtmlText(code);

  if (language !== null && refractor.registered(language)) {
    codeHtml = toHtml(refractor.highlight(code, language));
  }

  return `<pre><code${languageClass}>${codeHtml}</code></pre>`;
}

async function wrapMarkdownCodeBlocks(source: string): Promise<string> {
  const codeBlockRegex =
    /(^|\n)(?<indent>[ \t]*)(?<fence>`{3,}|~{3,})(?<info>[^\n]*)\n(?<code>[\s\S]*?)\n[ \t]*\k<fence>[ \t]*(?=\n|$)/gu;
  let result = "";
  let lastIndex = 0;

  for (const match of source.matchAll(codeBlockRegex)) {
    const groups = match.groups as
      | {
          code: string;
          fence: string;
          indent: string;
          info: string;
        }
      | undefined;

    if (typeof groups === "undefined" || typeof match.index !== "number") {
      continue;
    }

    const prefix = match[1] ?? "";
    const summary = getCodeDrawerSummary(groups.info);
    const code = await formatMarkdownCodeBlock(groups.code, groups.info);
    const codeBlockHtml = renderCodeBlockHtml(code, groups.info);
    const codeBlockSource = saveArticleCodeBlock(codeBlockHtml);

    result += source.slice(lastIndex, match.index);
    result += `${prefix}<ArticleCodeDrawer label={${JSON.stringify(summary)}} src={${JSON.stringify(
      codeBlockSource,
    )}} />`;
    lastIndex = match.index + match[0].length;
  }

  return result + source.slice(lastIndex);
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

function isBlogArticleMdx(id: string): boolean {
  return /\/src\/routes\/blog\/[^/]+\/index\.mdx(?:\?|$)/u.test(id);
}

function articleCodeDrawerMdxPlugin(): Plugin {
  return {
    name: "article-code-drawer-mdx",
    enforce: "pre",
    buildStart(): void {
      cleanGeneratedArticleCodeBlocks();
    },
    async transform(source, id): Promise<string | null> {
      if (!isBlogArticleMdx(id)) {
        return null;
      }

      const markdownWithArticleContents = addArticleContents(source);

      if (!markdownWithArticleContents.includes("```")) {
        return markdownWithArticleContents;
      }

      const markdownWithCodeDrawers = await wrapMarkdownCodeBlocks(markdownWithArticleContents);

      return addArticleCodeDrawerImport(markdownWithCodeDrawers);
    },
  };
}

export { articleCodeDrawerMdxPlugin };
