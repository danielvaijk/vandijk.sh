import prettier from "prettier";

import {
  NotionBlockType,
  type NotionBlock,
  type NotionBlockContents,
  type NotionRichText,
} from "~/definition/notion";
import { PRETTIER_CONFIG } from "~/definition/prettier";
import { createImageVariants, fetchAndProcessImage, saveImageInPublicDirectory } from "./image";
import { getRouteFromText } from "./url";

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

async function getAndStoreImageContentFromBlock({
  block,
  captionOverride,
  isPriority = false,
}: {
  block: NotionBlock;
  captionOverride?: string;
  isPriority?: boolean;
}): Promise<string> {
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

  const image = await fetchAndProcessImage(url);
  const variants = await createImageVariants(image);
  const shouldDisplayCaption = !caption.startsWith("(HIDDEN)");

  const imageSources = [];

  for (let index = 0; index < variants.length; index++) {
    const variant = variants[index];
    const variantSize = `${variant.width}w`;
    const variantPath = await saveImageInPublicDirectory(variant);

    imageSources.push([variantPath, variantSize].join(" "));
  }

  return [
    "<figure>",
    "<img",
    `src="${imageSources[0].split(" ")[0]}"`,
    `srcset="${imageSources.join(", ")}"`,
    `sizes="(max-width: 46rem) 90vw, 46rem"`,
    `alt="${shouldDisplayCaption ? caption : caption.slice("(HIDDEN)".length).trim()}"`,
    `decoding="${isPriority ? "sync" : "async"}"`,
    `loading="${isPriority ? "eager" : "lazy"}"`,
    `width="${variants[0].width}"`,
    `height="${variants[0].height}"`,
    "/>",
    shouldDisplayCaption ? `<figcaption>${caption}</figcaption>` : undefined,
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
        content = `[${content}](#${getRouteFromText(content)})`;
        anchorLinks += `- ${content}\n`;
        break;

      case NotionBlockType.HEADING_THREE:
        prefix = "###";
        content = getTextContentFromBlock(block);
        content = `[${content}](#${getRouteFromText(content)})`;
        anchorLinks += `  - ${content}\n`;
        break;

      case NotionBlockType.IMAGE:
        content = await getAndStoreImageContentFromBlock({ block });
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
  convertBlocksToMarkup,
  getTextContentFromBlock,
  getAndStoreImageContentFromBlock,
};
