import prettier from "prettier";

import {
  NotionBlockType,
  type NotionBlock,
  type NotionBlockContents,
  type NotionRichText,
} from "~/definition/notion";
import { PRETTIER_CONFIG } from "~/definition/prettier";
import { getReadTimeInMinutesFromWordCount, getWordCount } from "~/utilities/text";
import { slugify } from "~/utilities/url";

import {
  ImageFormat,
  createImageVariants,
  fetchAndProcessImage,
  type ProcessedImage,
  type ImageSourceSet,
  createSourceSetFromImageVariants,
  saveImage,
  serializeSourceSet,
} from "./image";
import { isNextIndexBlockOfType } from "./notion";
import { formatDateAsString } from "~/utilities/time";

interface ImageCaption {
  text: string;
  isHidden: boolean;
}

interface ImageContent {
  url: string;
  caption: ImageCaption;
}

interface ConvertedMarkup {
  anchorLinks: string;
  articleContent: string;
  readTime: number;
}

function getRichTextContentFromBlock(block: NotionBlock) {
  const blockContent = block[block.type] as NotionBlockContents;
  const richTextList = blockContent.rich_text ?? [];

  return richTextList.reduce((result: string, richText: NotionRichText): string => {
    const { annotations = {} } = richText;
    const { content = "", link } = richText.text ?? {};

    let text = content;

    if (!text) {
      return result;
    }

    if (link) {
      text = `[${text}](${link.url})`;
    }

    // Bold and italic must come after each other, since bold & italic is ***.
    if (annotations.italic) {
      text = ["*", text, "*"].join("");
    }

    if (annotations.bold) {
      text = ["**", text, "**"].join("");
    }

    if (annotations.code) {
      text = ["`", text, "`"].join("");
    }

    return result + text;
  }, "");
}

function getImageContentFromBlock({
  block,
  captionOverride,
}: {
  block: NotionBlock;
  captionOverride?: string;
}): ImageContent {
  const content = block[block.type] as NotionBlockContents;

  if (typeof content.type === "undefined") {
    throw new Error("Image content is missing a content type.");
  }

  const { url } = content[content.type] ?? {};
  const caption = captionOverride ?? content.caption?.[0]?.plain_text;

  if (!url) {
    throw new Error("Image content is missing a URL.");
  } else if (!caption) {
    throw new Error("Image content is missing a caption.");
  }

  const isCaptionHidden = caption.startsWith("(HIDDEN)");
  const captionWithoutTag = isCaptionHidden ? caption.slice("(HIDDEN)".length).trim() : caption;

  return {
    url,
    caption: {
      isHidden: isCaptionHidden,
      text: captionWithoutTag,
    },
  };
}

function renderImageMarkup({
  image,
  caption,
  publicPath,
  isPriority = false,
  avifSourceSet: avifSources = [],
  webpSourceSet: webpSources = [],
}: {
  image: ProcessedImage;
  caption: ImageCaption;
  publicPath: string;
  isPriority?: boolean;
  avifSourceSet?: Array<ImageSourceSet>;
  webpSourceSet?: Array<ImageSourceSet>;
}): string {
  const { metadata } = image;
  const isSingleImage = avifSources.length + webpSources.length === 0;

  const src = `src="${publicPath}"`;
  const width = `width="${metadata.width}"`;
  const height = `height="${metadata.height}"`;
  const decoding = `decoding="${isPriority ? "sync" : "async"}"`;
  const loading = `loading="${isPriority ? "eager" : "lazy"}"`;
  const alt = `alt="${caption.text}"`;

  const img = `<img ${src} ${width} ${height} ${alt} ${decoding} ${loading} />`;
  const figcaption = caption.isHidden ? null : `<figcaption>${caption.text}</figcaption>`;

  if (isSingleImage) {
    return ["<figure>", img, figcaption, "</figure>"].filter((value) => value).join("\n");
  }

  const sizes = `sizes="(max-width: 46rem) 90vw, 46rem"`;
  const avifSourceSet = `srcset="${serializeSourceSet(avifSources)}"`;
  const webpSourceSet = `srcset="${serializeSourceSet(webpSources)}"`;

  return [
    "<figure>",
    "<picture>",
    `<source ${sizes} ${avifSourceSet} />`,
    `<source ${sizes} ${webpSourceSet} />`,
    img,
    "</picture>",
    figcaption,
    "</figure>",
  ]
    .filter((value) => value)
    .join("\n");
}

async function generateImagesWithMarkup({
  image,
  caption,
  publicPath,
  isPriority = false,
}: {
  image: ProcessedImage;
  caption: ImageCaption;
  publicPath?: string;
  isPriority?: boolean;
}) {
  if (publicPath) {
    return renderImageMarkup({
      image,
      caption,
      publicPath,
      isPriority,
    });
  }

  const avifVariants = await createImageVariants(image, ImageFormat.AVIF);
  const webpVariants = await createImageVariants(image, ImageFormat.WEBP);

  const avifSourceSet = await createSourceSetFromImageVariants(avifVariants);
  const webpSourceSet = await createSourceSetFromImageVariants(webpVariants);

  return renderImageMarkup({
    image,
    caption,
    isPriority,
    avifSourceSet,
    webpSourceSet,
    // We use the smallest WebP variant as fallback.
    publicPath: webpSourceSet[0].path,
  });
}

async function getCodeContentFromBlock(block: NotionBlock): Promise<string> {
  const content = block[block.type] as NotionBlockContents;
  const code = content.rich_text?.[0]?.plain_text;

  if (!code) {
    return ["```", "", "```"].join("\n");
  }

  const prettierSupportInfo = await prettier.getSupportInfo();

  const { language = "" } = content;
  const supportedLanguages = prettierSupportInfo.languages.map(({ name }) => name.toLowerCase());

  let codeOutput;

  if (supportedLanguages.includes(language)) {
    codeOutput = await prettier.format(code, {
      ...PRETTIER_CONFIG,
      printWidth: 80,
      parser: language,
    });
  } else {
    codeOutput = code + "\n";
  }

  return [
    "{/* prettier-ignore-start */}",
    "\n",
    "```",
    language,
    "\n",
    codeOutput,
    "```",
    "\n",
    "{/* prettier-ignore-end */}",
  ].join("");
}

async function convertBlocksToMarkup(blocks: Array<NotionBlock>): Promise<ConvertedMarkup> {
  let articleContent = "";
  let anchorLinks = "";

  let wordCount = 0;
  let numberedItemCount = 0;

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];

    let content = "";
    let prefix = "";
    let spacer = "\n\n";

    switch (block.type) {
      case NotionBlockType.PARAGRAPH:
        content = getRichTextContentFromBlock(block);
        wordCount += getWordCount(content);
        break;

      case NotionBlockType.BULLETED_LIST_ITEM:
        prefix = "-";
        content = getRichTextContentFromBlock(block);
        wordCount += getWordCount(content);

        if (isNextIndexBlockOfType(blocks, index, NotionBlockType.BULLETED_LIST_ITEM)) {
          spacer = "\n";
        }
        break;

      case NotionBlockType.NUMBERED_LIST_ITEM:
        prefix = `${++numberedItemCount}.`;
        content = getRichTextContentFromBlock(block);
        wordCount += getWordCount(content);

        if (isNextIndexBlockOfType(blocks, index, NotionBlockType.NUMBERED_LIST_ITEM)) {
          spacer = "\n";
        } else {
          numberedItemCount = 0;
        }
        break;

      case NotionBlockType.HEADING_ONE:
        prefix = "#";
        content = getRichTextContentFromBlock(block);
        wordCount += getWordCount(content);
        break;

      case NotionBlockType.HEADING_TWO:
        prefix = "##";
        content = getRichTextContentFromBlock(block);
        wordCount += getWordCount(content);

        content = `[${content}](#${slugify(content)})`;
        anchorLinks += `- ${content}\n`;
        break;

      case NotionBlockType.HEADING_THREE:
        prefix = "###";
        content = getRichTextContentFromBlock(block);
        wordCount += getWordCount(content);

        content = `[${content}](#${slugify(content)})`;
        anchorLinks += `  - ${content}\n`;
        break;

      case NotionBlockType.IMAGE:
        {
          const imageContent = getImageContentFromBlock({ block });
          const imageData = await fetchAndProcessImage(imageContent.url);

          let publicPath;

          if (imageData.willUseOriginal) {
            publicPath = await saveImage(imageData);
          }

          content = await generateImagesWithMarkup({
            publicPath,
            image: imageData,
            caption: imageContent.caption,
          });
        }
        break;

      case NotionBlockType.CODE:
        content = await getCodeContentFromBlock(block);
        break;

      default:
        throw new Error(`Block type "${block.type}" is not supported.`);
    }

    if (!content.length) {
      continue;
    }

    if (prefix) {
      articleContent += prefix + " " + content + spacer;
    } else {
      articleContent += content + spacer;
    }
  }

  const readTime = getReadTimeInMinutesFromWordCount(wordCount);

  return {
    articleContent,
    anchorLinks,
    readTime,
  };
}

function generateMdxArticlePage({
  pageUrl,
  title,
  description,
  topic,
  date,
  coverImage,
  readTime,
  anchorLinks,
  articleContent,
}: {
  pageUrl: string;
  title: string;
  description: string;
  topic: string;
  date: Date;
  readTime: number;
  anchorLinks: string;
  articleContent: string;
  coverImage: {
    url: string;
    alt: string;
    type: string;
    width: number;
    height: number;
    markup: string;
  };
}) {
  return `
---
title: ${title}
description: "${description}"
author: Daniel van Dijk
opengraph:
  - title: true
  - description: true
  - type: article
  - url: ${pageUrl}
  - article:author: Daniel van Dijk
  - article:published_time: ${date.toISOString()}
  - tag: ${topic}
  - locale: en_US
  - site_name: Daniel van Dijk
  - image: ${coverImage.url}
    image:alt: ${coverImage.alt}
    image:type: ${coverImage.type}
    image:width: ${coverImage.width}
    image:height: ${coverImage.height}
---

export default function Layout({ children: content }) {
  return <article>{content}</article>;
}

${coverImage.markup}

# ${title}

<time dateTime="${date.toISOString()}" role="doc-subtitle">
  ${formatDateAsString(date)}
</time>

---

## Contents

A ~${readTime} min read on ${topic}.

${anchorLinks}

---

${articleContent}
  `;
}

export {
  getImageContentFromBlock,
  convertBlocksToMarkup,
  getRichTextContentFromBlock,
  generateMdxArticlePage,
  generateImagesWithMarkup,
};
