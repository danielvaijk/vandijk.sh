import { format } from "oxfmt";

import {
  ImageFormat,
  createImageVariants,
  type ProcessedImage,
  type ImageSourceSet,
  createSourceSetFromImageVariants,
  serializeSourceSet,
} from "src/helpers/image";
import { formatDateAsString } from "src/utilities/time";

interface ImageCaption {
  altText: string;
  isHidden: boolean;
  theme?: string;
}

interface GenerateImagesWithMarkupOptions {
  caption: ImageCaption;
  image: ProcessedImage;
  isPriority?: boolean;
  publicPath?: string;
}

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

function extractCaptionValues(captionRaw: string): ImageCaption {
  const caption: ImageCaption = {
    altText: captionRaw,
    isHidden: false,
  };

  const prefixRegex = /^\s*(?:\((?<prefixValues>.*?)\))?\s*(?<altText>.*)$/u;
  const prefixMatch = prefixRegex.exec(captionRaw);

  if (prefixMatch !== null) {
    const [, prefixContent, altText] = prefixMatch;

    if (typeof prefixContent !== "undefined") {
      for (const prefixValue of prefixContent.split(",")) {
        switch (prefixValue.trim()) {
          case "HIDDEN":
            caption.isHidden = true;
            break;
          case "DARK":
            caption.theme = "dark";
            break;
          case "LIGHT":
            caption.theme = "light";
            break;
          default:
            break;
        }
      }
    }

    caption.altText = altText;
  }

  return caption;
}

function renderImageMarkup({
  avifSourceSet: avifSources = [],
  caption,
  image,
  isPriority = false,
  publicPath,
  webpSourceSet: webpSources = [],
}: {
  avifSourceSet?: Array<ImageSourceSet>;
  caption: ImageCaption;
  image: ProcessedImage;
  isPriority?: boolean;
  publicPath: string;
  webpSourceSet?: Array<ImageSourceSet>;
}): string {
  const { metadata } = image;
  const isSingleImage = avifSources.length + webpSources.length === 0;

  const src = `src="${publicPath}"`;
  const width = `width="${metadata.width}"`;
  const height = `height="${metadata.height}"`;
  const decoding = `decoding="${isPriority ? "sync" : "async"}"`;
  const loading = `loading="${isPriority ? "eager" : "lazy"}"`;
  const alt = `alt="${caption.altText}"`;

  const img = `<img ${src} ${width} ${height} ${alt} ${decoding} ${loading} />`;
  const figcaption = caption.isHidden ? null : `<figcaption>${caption.altText}</figcaption>`;
  let figureOpenTag = "<figure>";

  if (typeof caption.theme !== "undefined") {
    figureOpenTag = `<figure class="${caption.theme}-only">`;
  }

  if (isSingleImage) {
    return [figureOpenTag, img, figcaption, "</figure>"]
      .filter((value): boolean => value !== null)
      .join("\n");
  }

  const sizes = `sizes="(max-width: 46rem) 90vw, 46rem"`;
  const avifSourceSet = `srcset="${serializeSourceSet(avifSources)}"`;
  const webpSourceSet = `srcset="${serializeSourceSet(webpSources)}"`;

  return [
    figureOpenTag,
    "<picture>",
    `<source ${sizes} ${avifSourceSet} />`,
    `<source ${sizes} ${webpSourceSet} />`,
    img,
    "</picture>",
    figcaption,
    "</figure>",
  ]
    .filter((value): boolean => value !== null)
    .join("\n");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function getCodeDrawerSummary(info: string): string {
  const language = info.trim().split(/\s+/u)[0];

  if (typeof language === "string" && language.length > 0) {
    return language.toUpperCase();
  }

  return "Code";
}

function getCodeBlockFileName(info: string): string | null {
  const language = info.trim().split(/\s+/u)[0]?.toLowerCase();

  if (typeof language !== "string" || language.length === 0) {
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

async function wrapMarkdownCodeBlocks(content: string): Promise<string> {
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
    const summary = escapeHtmlText(getCodeDrawerSummary(groups.info));
    const code = await formatMarkdownCodeBlock(groups.code, groups.info);
    const codeBlock = `${groups.indent}${groups.fence}${groups.info}\n${code}\n${groups.indent}${groups.fence}`;

    result += content.slice(lastIndex, match.index);
    result += `${prefix}<details class="article-code-drawer">
<summary>${summary}</summary>

${codeBlock}

</details>`;
    lastIndex = match.index + match[0].length;
  }

  result += content.slice(lastIndex);

  return result;
}

async function generateImagesWithMarkup({
  caption,
  image,
  isPriority = false,
  publicPath,
}: GenerateImagesWithMarkupOptions): Promise<string> {
  if (typeof publicPath === "string" && publicPath.length > 0) {
    return renderImageMarkup({
      caption,
      image,
      isPriority,
      publicPath,
    });
  }

  const avifVariants = await createImageVariants(image, ImageFormat.AVIF);
  const webpVariants = await createImageVariants(image, ImageFormat.WEBP);

  const avifSourceSet = await createSourceSetFromImageVariants(avifVariants);
  const webpSourceSet = await createSourceSetFromImageVariants(webpVariants);

  return renderImageMarkup({
    avifSourceSet,
    caption,
    image,
    isPriority,
    publicPath: webpSourceSet[0].path,
    webpSourceSet,
  });
}

async function generateMdxArticlePage({
  anchorLinks,
  articleContent,
  coverImage,
  date,
  description,
  pageUrl,
  readTime,
  title,
  topic,
}: {
  anchorLinks: string;
  articleContent: string;
  coverImage: {
    alt: string;
    framesPath: string;
    height: number;
    markup: string;
    publicPath: string;
    type: string;
    url: string;
    width: number;
  };
  date: Date;
  description: string;
  pageUrl: string;
  readTime: number;
  title: string;
  topic: string;
}): Promise<string> {
  const articleBody = await wrapMarkdownCodeBlocks(articleContent);

  return `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
author: Daniel van Dijk
opengraph:
  - title: true
  - description: true
  - type: article
  - url: ${pageUrl}
  - article:author: Daniel van Dijk
  - article:published_time: ${date.toISOString()}
  - tag: ${JSON.stringify(topic)}
  - locale: en_US
  - site_name: Daniel van Dijk
  - image: ${coverImage.url}
    image:alt: ${JSON.stringify(coverImage.alt)}
    image:type: ${coverImage.type}
    image:width: ${coverImage.width}
    image:height: ${coverImage.height}
---

import { GlyphRaster } from "src/components/glyph-raster";

export default function Layout({ children: content }) {
  return <article>{content}</article>;
}

<div class="article-cover-glyph-raster">
  <GlyphRaster layout="fill" source={{ type: "frames", url: ${JSON.stringify(coverImage.framesPath)} }} />

${coverImage.markup}
</div>

# ${title}

<time dateTime="${date.toISOString()}" role="doc-subtitle">
  ${formatDateAsString(date)}
</time>

---

## Contents

A ~${readTime} min read on ${topic}.

${anchorLinks}

---

${articleBody}
`;
}

export {
  extractCaptionValues,
  generateMdxArticlePage,
  generateImagesWithMarkup,
  wrapMarkdownCodeBlocks,
};
