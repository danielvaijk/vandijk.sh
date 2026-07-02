import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateGlyphFrameSource } from "src/helpers/glyph-frames";
import { getMarkdownProseWordCount, getReadTimeInMinutesFromWordCount } from "src/utilities/text";

interface ArticleFrontmatter {
  cover: string;
  coverAlt: string;
  date: string;
  description: string;
  draft?: string;
  title: string;
  topic: string;
}

const ARTICLE_METADATA_DIRECTORY = "./src/media";
const ARTICLES_METADATA_FILE_PATH = `${ARTICLE_METADATA_DIRECTORY}/articles.json`;
const ARTICLES_DIRECTORY = "./src/routes/blog";
const ARTICLE_COVER_GLYPH_FRAME_RATE = 1;
const ARTICLE_COVER_GLYPH_FRAME_ROWS = 64;

function readArticleFiles(): Array<{ filePath: string; path: string }> {
  return readdirSync(ARTICLES_DIRECTORY, { withFileTypes: true }).flatMap((entity) => {
    if (!entity.isDirectory()) {
      return [];
    }

    const filePath = join(ARTICLES_DIRECTORY, entity.name, "index.mdx");

    if (!existsSync(filePath)) {
      return [];
    }

    return [{ filePath, path: entity.name }];
  });
}

function parseFrontmatter(filePath: string): { content: string; data: ArticleFrontmatter } {
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

function renderCoverImageMarkup(cover: string, coverAlt: string): string {
  const alt = getCaptionAltText(coverAlt);

  return `<figure>
<img src="${cover}" alt="${alt}" loading="lazy" decoding="async" />
</figure>`;
}

async function generateCoverFrames(path: string, cover: string): Promise<string> {
  const framesPath = `/blog/${path}/cover.frames`;

  await generateGlyphFrameSource({
    fps: ARTICLE_COVER_GLYPH_FRAME_RATE,
    output: join("./public", framesPath),
    rows: ARTICLE_COVER_GLYPH_FRAME_ROWS,
    source: join("./public", cover),
  });

  return framesPath;
}

const results = [];

for (const { filePath, path } of readArticleFiles()) {
  const { content, data } = parseFrontmatter(filePath);

  if (data.draft === "true") {
    continue;
  }

  const date = new Date(data.date);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${filePath} has an invalid date.`);
  }

  const articleContent = stripLeadingWikiMetadata(stripDuplicateTitle(content, data.title));
  const readTime = getReadTimeInMinutesFromWordCount(getMarkdownProseWordCount(articleContent));
  const coverImageFramesPath = await generateCoverFrames(path, data.cover);

  results.push({
    coverImageFramesPath,
    coverImageMarkup: renderCoverImageMarkup(data.cover, data.coverAlt),
    coverImagePublicPath: data.cover,
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

const serializedResults = `${JSON.stringify(sortedResults, null, 2)}\n`;

if (!existsSync(ARTICLE_METADATA_DIRECTORY)) {
  mkdirSync(ARTICLE_METADATA_DIRECTORY);
}

writeFileSync(ARTICLES_METADATA_FILE_PATH, serializedResults);
