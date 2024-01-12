import prettier from "prettier";

import {
  NotionBlockType,
  type NotionBlock,
  type NotionBlockContents,
  type NotionRichText,
} from "~/definition/notion";
import { PRETTIER_CONFIG } from "~/definition/prettier";
import {
  ImageFormat,
  createImageVariants,
  fetchAndProcessImage,
  type ProcessedImage,
  type ImageSourceSet,
  createSourceSetsFromImageVariants,
  saveImage,
} from "./image";
import { slugify } from "../utilities/url";

interface ImageCaption {
  text: string;
  isHidden: boolean;
}

interface ImageContent {
  url: string;
  caption: ImageCaption;
}

function isNextIndexBlockOfType(array: Array<NotionBlock>, index: number, type: NotionBlockType) {
  return index < array.length - 1 && array[index + 1].type === type;
}

function getContentFromRichText(richTexts: Array<NotionRichText>) {
  return richTexts.reduce((result: string, richText: NotionRichText): string => {
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

function getTextContentFromBlock(block: NotionBlock): string {
  const { rich_text: richText } = block[block.type] as NotionBlockContents;

  if (!richText) {
    return "";
  }

  return getContentFromRichText(richText);
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

function createMarkupForImage({
  image,
  caption,
  publicPath,
  isPriority = false,
  avifSourceSets = [],
  webpSourceSets = [],
}: {
  image: ProcessedImage;
  caption: ImageCaption;
  publicPath: string;
  isPriority?: boolean;
  avifSourceSets?: Array<ImageSourceSet>;
  webpSourceSets?: Array<ImageSourceSet>;
}): string {
  const { width, height } = image.metadata;
  const isSingleImage = avifSourceSets.length + webpSourceSets.length === 0;

  const widthAttribute = `width="${width}"`;
  const heightAttribute = `height="${height}"`;
  const decoding = `decoding="${isPriority ? "sync" : "async"}"`;
  const loading = `loading="${isPriority ? "eager" : "lazy"}"`;
  const alt = `alt="${caption.text}"`;
  const sizes = `sizes="(max-width: 46rem) 90vw, 46rem"`;

  if (isSingleImage) {
    return [
      "<figure>",
      `<img src="${publicPath}" ${widthAttribute} ${heightAttribute} ${alt} ${decoding} ${loading} />`,
      !caption.isHidden && `<figcaption>${caption.text}</figcaption>`,
      "</figure>",
    ]
      .filter((value) => value)
      .join("\n");
  }

  const createSourceSetAttribute = (sources: Array<ImageSourceSet>): string => {
    return `srcset="${sources.map(({ path, size }) => [path, size].join(" ")).join(", ")}"`;
  };

  return [
    "<figure>",
    "<picture>",
    `<source ${sizes} ${createSourceSetAttribute(avifSourceSets)} />`,
    `<source ${sizes} ${createSourceSetAttribute(webpSourceSets)} />`,
    `<img src="${publicPath}" ${widthAttribute} ${heightAttribute} ${alt} ${decoding} ${loading} />`,
    "</picture>",
    !caption.isHidden && `<figcaption>${caption.text}</figcaption>`,
    "</figure>",
  ]
    .filter((value) => value)
    .join("\n");
}

async function getCodeContentFromBlock(block: NotionBlock): Promise<string> {
  const content = block[block.type] as NotionBlockContents;
  const code = content.rich_text?.[0]?.plain_text;

  if (!code) {
    return ["```", "", "```"].join("\n");
  }

  const { language } = content;
  const formatConfig = { ...PRETTIER_CONFIG, printWidth: 80, parser: language };
  const formattedCode = await prettier.format(code, formatConfig);

  return ["```", language, "\n", formattedCode, "```"].join("");
}

interface ConvertedMarkup {
  anchorLinks: string;
  articleContent: string;
}

async function convertBlocksToMarkup(blocks: Array<NotionBlock>): Promise<ConvertedMarkup> {
  let articleContent = "";
  let anchorLinks = "";

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];

    let content = "";
    let prefix = "";
    let spacer = "\n\n";

    switch (block.type) {
      case NotionBlockType.PARAGRAPH:
        content = getTextContentFromBlock(block);
        break;

      case NotionBlockType.BULLETED_LIST_ITEM:
        prefix = "-";
        content = getTextContentFromBlock(block);
        spacer = isNextIndexBlockOfType(blocks, index, NotionBlockType.BULLETED_LIST_ITEM)
          ? "\n"
          : spacer;
        break;

      case NotionBlockType.HEADING_ONE:
        prefix = "#";
        content = getTextContentFromBlock(block);
        break;

      case NotionBlockType.HEADING_TWO:
        prefix = "##";
        content = getTextContentFromBlock(block);
        content = `[${content}](#${slugify(content)})`;
        anchorLinks += `- ${content}\n`;
        break;

      case NotionBlockType.HEADING_THREE:
        prefix = "###";
        content = getTextContentFromBlock(block);
        content = `[${content}](#${slugify(content)})`;
        anchorLinks += `  - ${content}\n`;
        break;

      case NotionBlockType.IMAGE:
        {
          const imageContent = getImageContentFromBlock({ block });
          const imageData = await fetchAndProcessImage(imageContent.url);

          const options = {
            image: imageData,
            caption: imageContent.caption,
          };

          if (imageData.willUseOriginal) {
            content = createMarkupForImage({ ...options, publicPath: await saveImage(imageData) });
          } else {
            const avifVariants = await createImageVariants(imageData, ImageFormat.AVIF);
            const webpVariants = await createImageVariants(imageData, ImageFormat.WEBP);

            const avifSourceSets = await createSourceSetsFromImageVariants(avifVariants);
            const webpSourceSets = await createSourceSetsFromImageVariants(webpVariants);

            const publicPath = webpSourceSets[0].path;

            content = createMarkupForImage({
              ...options,
              publicPath,
              avifSourceSets,
              webpSourceSets,
            });
          }
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

  return {
    articleContent,
    anchorLinks,
  };
}

export {
  isNextIndexBlockOfType,
  getImageContentFromBlock,
  convertBlocksToMarkup,
  createMarkupForImage,
  getTextContentFromBlock,
};
