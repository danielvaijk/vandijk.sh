import prettier from "prettier";

import {
  NotionBlockType,
  type NotionBlock,
  type NotionBlockContents,
  type NotionRichText,
} from "src/definition/notion";
import { PRETTIER_CONFIG } from "src/definition/prettier";
import {
  ImageFormat,
  createImageVariants,
  fetchAndProcessImage,
  type ProcessedImage,
  type ImageSourceSet,
  createSourceSetFromImageVariants,
  saveImage,
  serializeSourceSet,
} from "src/helpers/image";
import { isNextIndexBlockOfType } from "src/helpers/notion";
import { getReadTimeInMinutesFromWordCount, getWordCount } from "src/utilities/text";
import { formatDateAsString } from "src/utilities/time";
import { slugify } from "src/utilities/url";

interface ImageCaption {
  isHidden: boolean;
  text: string;
}

interface ImageContent {
  caption: ImageCaption;
  url: string;
}

interface ConvertedMarkup {
  anchorLinks: string;
  articleContent: string;
  readTime: number;
}

function getRichTextContentFromBlock(block: NotionBlock): string {
  const blockContent = block[block.type] as NotionBlockContents;
  const richTextList = blockContent.rich_text ?? [];

  return richTextList.reduce((result: string, richText: NotionRichText): string => {
    const { annotations = {} } = richText;
    const { content = "", link } = richText.text ?? {};

    let text = content;

    if (typeof text === "undefined" || text.length === 0) {
      return result;
    }

    if (typeof link !== "undefined" && link !== null) {
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

  if (typeof url === "undefined" || url.length === 0) {
    throw new Error("Image content is missing a URL.");
  } else if (typeof caption === "undefined" || caption.length === 0) {
    throw new Error("Image content is missing a caption.");
  }

  const isCaptionHidden = caption.startsWith("(HIDDEN)");
  const captionWithoutTag = isCaptionHidden ? caption.slice("(HIDDEN)".length).trim() : caption;

  return {
    caption: {
      isHidden: isCaptionHidden,
      text: captionWithoutTag,
    },
    url,
  };
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
  const alt = `alt="${caption.text}"`;

  const img = `<img ${src} ${width} ${height} ${alt} ${decoding} ${loading} />`;
  const figcaption = caption.isHidden ? null : `<figcaption>${caption.text}</figcaption>`;

  if (isSingleImage) {
    return ["<figure>", img, figcaption, "</figure>"]
      .filter((value): boolean => value !== null)
      .join("\n");
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
    .filter((value): boolean => value !== null)
    .join("\n");
}

interface GenerateImagesWithMarkupOptions {
  caption: ImageCaption;
  image: ProcessedImage;
  isPriority?: boolean;
  publicPath?: string;
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
    // We use the smallest WebP variant as fallback.
    webpSourceSet,
  });
}

async function getCodeContentFromBlock(block: NotionBlock): Promise<string> {
  const content = block[block.type] as NotionBlockContents;
  const code = content.rich_text?.[0]?.plain_text;

  if (typeof code === "undefined" || code.length === 0) {
    return ["```", "", "```"].join("\n");
  }

  const prettierSupportInfo = await prettier.getSupportInfo();

  const { language = "" } = content;
  const supportedLanguages = prettierSupportInfo.languages.map(({ name: languageName }): string =>
    languageName.toLowerCase()
  );

  let codeOutput = `${code}\n`;

  if (supportedLanguages.includes(language)) {
    codeOutput = await prettier.format(code, {
      ...PRETTIER_CONFIG,
      parser: language,
      printWidth: 80,
    });
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
        numberedItemCount += 1;
        prefix = `${numberedItemCount}.`;
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

          const generateOptions: GenerateImagesWithMarkupOptions = {
            caption: imageContent.caption,
            image: imageData,
          };

          if (imageData.willUseOriginal) {
            generateOptions.publicPath = await saveImage(imageData);
          }

          content = await generateImagesWithMarkup(generateOptions);
        }
        break;

      case NotionBlockType.CODE:
        content = await getCodeContentFromBlock(block);
        break;

      default:
        throw new Error(`Block type "${block.type}" is not supported.`);
    }

    if (content.length === 0) {
      continue;
    }

    if (prefix.length > 0) {
      articleContent += `${prefix} ${content}${spacer}`;
    } else {
      articleContent += content + spacer;
    }
  }

  const readTime = getReadTimeInMinutesFromWordCount(wordCount);

  return {
    anchorLinks,
    articleContent,
    readTime,
  };
}

function generateMdxArticlePage({
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
    height: number;
    markup: string;
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
}): string {
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
