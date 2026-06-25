import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import prettierConfig from "@danielvaijk/prettier-config";
import prettier from "prettier";

import {
  fetchAndProcessImage,
  readAndProcessImage,
  saveImage,
  ImagePurpose,
  type ProcessedImage,
} from "src/helpers/image";
import {
  extractCaptionValues,
  generateMdxArticlePage,
  generateImagesWithMarkup,
} from "src/helpers/markup";
import { getReadTimeInMinutesFromWordCount, getWordCount } from "src/utilities/text";
import { joinPathNames, slugify, determineOriginUrl } from "src/utilities/url";

interface ArticleFrontmatter {
  cover: string;
  coverAlt: string;
  date: string;
  description: string;
  draft?: string;
  path?: string;
  title: string;
  topic: string;
}

interface Article {
  content: string;
  data: ArticleFrontmatter;
  filePath: string;
}

const ARTICLES_DIRECTORY = "./src/routes/blog";
const WIKI_DOWNLOAD_DIRECTORY = "./tmp/wiki";
const WIKI_ARTICLES_DIRECTORY = "./tmp/wiki/articles";
const WIKI_REPOSITORY = process.env.WIKI_REPOSITORY ?? "danielvaijk/wiki";
const WIKI_ARTICLES_PATH = "data/technical/blog/posts";
const WIKI_LOCAL_ARTICLES_PATH = join(homedir(), "wiki", WIKI_ARTICLES_PATH);

interface GitHubContentItem {
  content?: string;
  encoding?: string;
  name: string;
  path: string;
  type: "dir" | "file";
  url: string;
}

function shouldDownloadWikiFile(name: string): boolean {
  return /\.(?:avif|gif|jpe?g|md|png|svg|webp)$/iu.test(name);
}

function getGitHubRepository(): string {
  try {
    const url = new URL(WIKI_REPOSITORY);
    return url.pathname.replace(/^\/|\.git$/gu, "");
  } catch {
    return WIKI_REPOSITORY.replace(/\.git$/u, "");
  }
}

function getRequiredGitHubToken(): string {
  if (
    typeof process.env.WIKI_GITHUB_TOKEN === "string" &&
    process.env.WIKI_GITHUB_TOKEN.length > 0
  ) {
    return process.env.WIKI_GITHUB_TOKEN;
  }

  if (process.env.CI !== "true") {
    try {
      return execFileSync("gh", ["auth", "token"], { encoding: "utf-8" }).trim();
    } catch {
      // Fall through to the clearer build error below.
    }
  }

  throw new Error(
    "WIKI_GITHUB_TOKEN is required to fetch wiki articles. Locally, run `gh auth login`."
  );
}

function getContentsApiUrl(repository: string, path: string): string {
  const encodedPath = path
    .split("/")
    .map((part): string => encodeURIComponent(part))
    .join("/");

  return `https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=main`;
}

async function fetchGitHubContents(
  url: string
): Promise<GitHubContentItem | Array<GitHubContentItem>> {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${getRequiredGitHubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) {
    throw new Error(`Wiki article directory "${WIKI_ARTICLES_PATH}" does not exist.`);
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed with ${response.status} ${response.statusText}.`);
  }

  return (await response.json()) as GitHubContentItem | Array<GitHubContentItem>;
}

async function downloadGitHubDirectory(url: string, targetDirectory: string): Promise<void> {
  const contents = await fetchGitHubContents(url);

  if (!Array.isArray(contents)) {
    throw new Error(`Wiki article path "${WIKI_ARTICLES_PATH}" is not a directory.`);
  }

  mkdirSync(targetDirectory, { recursive: true });

  for (const item of contents) {
    const targetPath = join(targetDirectory, item.name);

    if (item.type === "dir") {
      await downloadGitHubDirectory(item.url, targetPath);
      continue;
    }

    if (item.type !== "file" || !shouldDownloadWikiFile(item.name)) {
      continue;
    }

    const file = await fetchGitHubContents(item.url);

    if (Array.isArray(file) || file.encoding !== "base64" || typeof file.content !== "string") {
      throw new Error(`Could not download wiki file "${item.path}".`);
    }

    writeFileSync(targetPath, Buffer.from(file.content, "base64"));
  }
}

async function downloadWikiArticles(): Promise<void> {
  rmSync(WIKI_DOWNLOAD_DIRECTORY, { force: true, recursive: true });

  if (process.env.CI !== "true" && existsSync(WIKI_LOCAL_ARTICLES_PATH)) {
    cpSync(WIKI_LOCAL_ARTICLES_PATH, WIKI_ARTICLES_DIRECTORY, {
      recursive: true,
    });
    return;
  }

  const repository = getGitHubRepository();
  const url = getContentsApiUrl(repository, WIKI_ARTICLES_PATH);

  await downloadGitHubDirectory(url, WIKI_ARTICLES_DIRECTORY);
}

function readMarkdownFiles(directory: string): Array<string> {
  const results: Array<string> = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...readMarkdownFiles(path));
    } else if (entry.isFile() && path.endsWith(".md")) {
      results.push(path);
    }
  }

  return results;
}

function parseFrontmatter(filePath: string): Article {
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
    data: data as unknown as ArticleFrontmatter,
    filePath,
  };
}

function getAnchorLinks(content: string): string {
  return content
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

function cleanGeneratedArticles(): void {
  for (const entry of readdirSync(ARTICLES_DIRECTORY, { withFileTypes: true })) {
    const directory = join(ARTICLES_DIRECTORY, entry.name);

    if (
      entry.isDirectory() &&
      existsSync(join(directory, "index.mdx")) &&
      existsSync(join(directory, "meta.json"))
    ) {
      rmSync(directory, { force: true, recursive: true });
    }
  }
}

async function processArticleCover(cover: string): Promise<ProcessedImage> {
  if (/^https?:\/\//u.test(cover)) {
    return fetchAndProcessImage(cover, ImagePurpose.ARTICLE_COVER);
  }

  return readAndProcessImage(join(WIKI_ARTICLES_DIRECTORY, cover), ImagePurpose.ARTICLE_COVER);
}

await downloadWikiArticles();
cleanGeneratedArticles();

const articleSourceDirectory = WIKI_ARTICLES_DIRECTORY;

if (!existsSync(articleSourceDirectory)) {
  throw new Error(`Wiki article directory "${WIKI_ARTICLES_PATH}" does not exist.`);
}

const articles = readMarkdownFiles(articleSourceDirectory)
  .map(parseFrontmatter)
  .filter(({ data }): boolean => data.draft !== "true");

const originUrl = determineOriginUrl();

for (const { content, data, filePath } of articles) {
  const { cover, coverAlt, description, title, topic } = data;
  const date = new Date(data.date);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${filePath} has an invalid date.`);
  }

  const articleContent = stripLeadingWikiMetadata(stripDuplicateTitle(content, title));
  const articleRoute = data.path ?? slugify(title);
  const articleDirectory = joinPathNames(ARTICLES_DIRECTORY, articleRoute);
  const articleFilePath = joinPathNames(articleDirectory, "index.mdx");
  const articleMetadataPath = joinPathNames(articleDirectory, "meta.json");
  const pageUrl = joinPathNames(originUrl, "blog", articleRoute);

  const coverImageData = await processArticleCover(cover);
  const coverImagePublicPath = await saveImage(coverImageData);
  const coverImageMarkup = await generateImagesWithMarkup({
    caption: extractCaptionValues(coverAlt),
    image: coverImageData,
    isPriority: true,
  });
  const readTime = getReadTimeInMinutesFromWordCount(getWordCount(articleContent));

  const coverImage = {
    alt: coverAlt,
    height: coverImageData.metadata.height,
    markup: coverImageMarkup,
    type: `image/${coverImageData.metadata.format}`,
    url: joinPathNames(originUrl, coverImagePublicPath),
    width: coverImageData.metadata.width,
  };

  const articleMarkup = await prettier.format(
    generateMdxArticlePage({
      anchorLinks: getAnchorLinks(articleContent),
      articleContent,
      coverImage,
      date,
      description,
      pageUrl,
      readTime,
      title,
      topic,
    }),
    {
      parser: "mdx",
      printWidth: Infinity,
    }
  );

  const articleMetadata = await prettier.format(
    JSON.stringify({
      date: date.toISOString(),
      path: articleRoute,
      title,
      coverImageMarkup,
      description,
      readTime,
      topic,
    }),
    {
      parser: "json",
      ...prettierConfig,
    }
  );

  mkdirSync(articleDirectory, { recursive: true });
  writeFileSync(articleFilePath, articleMarkup);
  writeFileSync(articleMetadataPath, articleMetadata);
}

export {};
