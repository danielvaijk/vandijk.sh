import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, parse, resolve } from "node:path";

import { toHtml } from "hast-util-to-html";
import { format } from "oxfmt";
import { refractor } from "refractor";
import tsx from "refractor/tsx";
import type { Plugin, ResolvedConfig } from "vite";

import type { GlyphRasterFrameOptions } from "../src/vfx/glyph-raster/frame-options";
import { generateGreyscaleFrameSource } from "./frame-greyscale-sampler";
import { ensureArticleImages } from "./image-optimizer";

interface ArticleMetadataFrontmatter {
  cover: string;
  coverAlt: string;
  date: string;
  description: string;
  draft?: string;
  title: string;
  topic: string;
}

interface ArticleMdxFrontmatter {
  date?: string;
  title?: string;
  topic?: string;
}

interface ArticleMetadata {
  coverImageFramesPath: string;
  coverImageMarkup: string;
  date: string;
  description: string;
  path: string;
  readTime: number;
  title: string;
  topic: string;
}

interface CodeBlockContent {
  html: string;
  info: string;
}

interface WrapMarkdownCodeBlocksOptions {
  saveCodeBlockContent?: (content: CodeBlockContent) => Promise<string>;
}

const ARTICLE_CODE_DRAWER_IMPORT =
  'import { ArticleCodeDrawer } from "src/components/article-code-drawer";';
const ARTICLES_METADATA_MODULE_ID = "virtual:articles";
const RESOLVED_ARTICLES_METADATA_MODULE_ID = `\0${ARTICLES_METADATA_MODULE_ID}`;
const ARTICLES_DIRECTORY = "src/routes/blog";
const ARTICLE_PUBLIC_ASSETS_DIRECTORY = "public/blog";
const ARTICLE_SOURCE_ASSETS_DIRECTORY_NAME = "assets";
const ARTICLES_PUBLIC_DIRECTORY = "./public/blog";
const CODE_BLOCK_PRINT_WIDTH = 80;
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
const MARKDOWN_CODE_BLOCK_REGEX =
  /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/u;
const WORDS_PER_MINUTE = 200;

refractor.register(tsx);

function readArticleFiles(root: string): Array<{ filePath: string; path: string }> {
  const articlesDirectory = resolve(root, ARTICLES_DIRECTORY);

  return readdirSync(articlesDirectory, { withFileTypes: true }).flatMap((entity) => {
    if (!entity.isDirectory()) {
      return [];
    }

    const filePath = join(articlesDirectory, entity.name, "index.mdx");

    if (!existsSync(filePath)) {
      return [];
    }

    return [{ filePath, path: entity.name }];
  });
}

function parseArticleMetadataFrontmatter(filePath: string): {
  content: string;
  data: ArticleMetadataFrontmatter;
} {
  const markdown = readFileSync(filePath, "utf-8");
  const match = /^---\n(?<frontmatter>[\s\S]*?)\n---\n?(?<content>[\s\S]*)$/u.exec(markdown);

  if (match?.groups === undefined) {
    throw new Error(`${filePath} is missing frontmatter.`);
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

  for (const key of ["cover", "coverAlt", "date", "description", "title", "topic"]) {
    if (typeof data[key] !== "string" || data[key].length === 0) {
      throw new Error(`${filePath} is missing frontmatter field "${key}".`);
    }
  }

  return {
    content: match.groups.content.trim(),
    data: data as unknown as ArticleMetadataFrontmatter,
  };
}

function getCaptionAltText(captionRaw: string): string {
  return captionRaw.replace(/^\s*(?:\(.*?\))?\s*/u, "");
}

function stripDuplicateTitle(content: string, title: string): string {
  const firstLine = content.split("\n", 1)[0]?.trim();

  if (firstLine === `# ${title}`) {
    return content.slice(firstLine.length).trim();
  }

  return content;
}

function stripLeadingWikiMetadata(content: string): string {
  return content.replace(/^(?:owner|tags|last_edited_time|cover_alt|snippet): .*\n/gmu, "").trim();
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function escapeJsString(value: string): string {
  return JSON.stringify(value);
}

function getCodeDrawerSummary(info: string): string {
  const language = info.trim().split(/\s+/u)[0];

  if (typeof language === "string" && language.length > 0) {
    return language.toUpperCase();
  }

  return "Code";
}

function getCodeBlockLanguage(info: string): string | null {
  const language = info.trim().split(/\s+/u)[0]?.toLowerCase();

  if (typeof language !== "string" || language.length === 0) {
    return null;
  }

  return language;
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

function getWordCount(text: string): number {
  const normalizedText = text.trim();

  if (normalizedText.length === 0) {
    return 0;
  }

  return normalizedText.split(/\s+/u).length;
}

function stripMarkdownCodeBlocks(markdown: string): string {
  return markdown.replace(MARKDOWN_CODE_BLOCK_REGEX, "$1");
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/u, "");
}

function stripMarkdownTextSyntax(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/[*_~]+/gu, "")
    .replace(/<[^>]+>/gu, " ");
}

function getMarkdownProseText(markdown: string): string {
  const lines = stripMarkdownCodeBlocks(stripFrontmatter(markdown)).split("\n");
  const proseLines = new Array<string>();
  let isInMdxBlock = false;
  let isInMdxExportBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      isInMdxBlock = false;
      isInMdxExportBlock = false;
      continue;
    }

    if (isInMdxBlock || isInMdxExportBlock) {
      continue;
    }

    if (/^import\s/u.test(trimmedLine)) {
      continue;
    }

    if (/^export\s/u.test(trimmedLine)) {
      isInMdxExportBlock = true;
      continue;
    }

    if (/^(?:[-*_]\s*){3,}$/u.test(trimmedLine)) {
      continue;
    }

    if (/^<[A-Za-z][\w.:-]*(?:[\s>/]|$)/u.test(trimmedLine)) {
      isInMdxBlock = !/\/>\s*$|<\/[A-Za-z][\w.:-]*>\s*$/u.test(trimmedLine);
      continue;
    }

    if (/^<\/[A-Za-z][\w.:-]*/u.test(trimmedLine) || /^[{}]/u.test(trimmedLine)) {
      continue;
    }

    proseLines.push(
      stripMarkdownTextSyntax(
        trimmedLine
          .replace(/^#{1,6}\s+/u, "")
          .replace(/^>\s?/u, "")
          .replace(/^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/u, ""),
      ),
    );
  }

  return proseLines.join("\n");
}

function getMarkdownProseWordCount(markdown: string): number {
  return getWordCount(getMarkdownProseText(markdown));
}

function getReadTimeInMinutesFromWordCount(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

function formatDateAsString(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
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

async function wrapMarkdownCodeBlocks(
  content: string,
  options: WrapMarkdownCodeBlocksOptions = {},
): Promise<string> {
  const codeBlockRegex =
    /(^|\n)(?<indent>[ \t]*)(?<fence>`{3,}|~{3,})(?<info>[^\n]*)\n(?<code>[\s\S]*?)\n[ \t]*\k<fence>[ \t]*(?=\n|$)/gu;
  let result = "";
  let lastIndex = 0;

  for (const match of content.matchAll(codeBlockRegex)) {
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
    const codeBlockSource =
      (await options.saveCodeBlockContent?.({
        html: codeBlockHtml,
        info: groups.info,
      })) ?? "";

    result += content.slice(lastIndex, match.index);
    result += `${prefix}<ArticleCodeDrawer label={${escapeJsString(summary)}} src={${escapeJsString(codeBlockSource)}} />`;
    lastIndex = match.index + match[0].length;
  }

  result += content.slice(lastIndex);

  return result;
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

function parseArticleMdxFrontmatter(source: string): {
  body: string;
  frontmatter: ArticleMdxFrontmatter;
} {
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

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/[^\w\\-]+/gu, "")
    .replace(/\\-\\-+/gu, "-");
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

  const { body, frontmatter } = parseArticleMdxFrontmatter(source);

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

function renderCoverImageMarkup(coverAlt: string): string {
  const alt = getCaptionAltText(coverAlt);

  return `<figure aria-label="${escapeHtmlText(alt)}" role="img"></figure>`;
}

function getArticleAssetsDirectory(root: string, path: string): string {
  return resolve(root, ARTICLES_DIRECTORY, path, ARTICLE_SOURCE_ASSETS_DIRECTORY_NAME);
}

function getArticlePublicAssetsDirectory(root: string, path: string): string {
  return resolve(root, ARTICLE_PUBLIC_ASSETS_DIRECTORY, path);
}

function getArticleAssetFileName(publicPath: string): string {
  return basename(publicPath);
}

async function generateCoverFrames(
  root: string,
  path: string,
  cover: string,
  glyphFrameOptions: GlyphRasterFrameOptions,
): Promise<string> {
  const framesPath = `/blog/${path}/cover.frames`;
  const coverFileName = getArticleAssetFileName(cover);

  await generateGreyscaleFrameSource(
    {
      output: resolve(root, "public", framesPath.replace(/^\//u, "")),
      source: join(getArticleAssetsDirectory(root, path), coverFileName),
    },
    glyphFrameOptions,
  );

  return framesPath;
}

async function generateArticleGifFrames(
  root: string,
  path: string,
  glyphFrameOptions: GlyphRasterFrameOptions,
): Promise<void> {
  const articleAssetsDirectory = getArticleAssetsDirectory(root, path);
  const articlePublicAssetsDirectory = getArticlePublicAssetsDirectory(root, path);

  if (!existsSync(articleAssetsDirectory)) {
    return;
  }

  for (const entity of readdirSync(articleAssetsDirectory, { withFileTypes: true })) {
    if (!entity.isFile() || !entity.name.toLowerCase().endsWith(".gif")) {
      continue;
    }

    const source = join(articleAssetsDirectory, entity.name);
    const { name } = parse(entity.name);
    const output = join(articlePublicAssetsDirectory, `${name}.frames`);

    await generateGreyscaleFrameSource({ output, source }, glyphFrameOptions);
  }
}

async function generateArticlesMetadata(
  root: string,
  glyphFrameOptions: GlyphRasterFrameOptions,
): Promise<Array<ArticleMetadata>> {
  const results: Array<ArticleMetadata> = [];

  for (const { filePath, path } of readArticleFiles(root)) {
    const { content, data } = parseArticleMetadataFrontmatter(filePath);

    if (data.draft === "true") {
      continue;
    }

    const date = new Date(data.date);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`${filePath} has an invalid date.`);
    }

    const articleContent = stripLeadingWikiMetadata(stripDuplicateTitle(content, data.title));
    const readTime = getReadTimeInMinutesFromWordCount(getMarkdownProseWordCount(articleContent));
    const coverImageFramesPath = await generateCoverFrames(
      root,
      path,
      data.cover,
      glyphFrameOptions,
    );
    await generateArticleGifFrames(root, path, glyphFrameOptions);

    results.push({
      coverImageFramesPath,
      coverImageMarkup: renderCoverImageMarkup(data.coverAlt),
      date: date.toISOString(),
      description: data.description,
      path,
      readTime,
      title: data.title,
      topic: data.topic,
    });
  }

  const sortedResults = results.sort((a, b): number => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);

    return dateB.getTime() - dateA.getTime();
  });
  return sortedResults;
}

function articlesMetadataPlugin(glyphFrameOptions: GlyphRasterFrameOptions): Plugin {
  let config: ResolvedConfig;
  let articlesMetadata: Promise<Array<ArticleMetadata>> | null = null;

  function ensureArticlesMetadata(): Promise<Array<ArticleMetadata>> {
    if (articlesMetadata === null) {
      articlesMetadata = (async (): Promise<Array<ArticleMetadata>> => {
        await ensureArticleImages(config.root);
        return generateArticlesMetadata(config.root, glyphFrameOptions);
      })();
    }

    return articlesMetadata;
  }

  return {
    name: "articles-metadata",
    configResolved(resolvedConfig): void {
      config = resolvedConfig;
    },
    resolveId(id): string | null {
      return id === ARTICLES_METADATA_MODULE_ID ? RESOLVED_ARTICLES_METADATA_MODULE_ID : null;
    },
    async buildStart(): Promise<void> {
      await ensureArticlesMetadata();
    },
    async load(id): Promise<string | null> {
      if (id !== RESOLVED_ARTICLES_METADATA_MODULE_ID) {
        return null;
      }

      const metadata = await ensureArticlesMetadata();

      return `export default ${JSON.stringify(metadata)};`;
    },
  };
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

function articleContentRendererPlugin(glyphFrameOptions: GlyphRasterFrameOptions): Array<Plugin> {
  return [articlesMetadataPlugin(glyphFrameOptions), articleCodeDrawerMdxPlugin()];
}

export { articleContentRendererPlugin, wrapMarkdownCodeBlocks };
