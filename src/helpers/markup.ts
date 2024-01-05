import prettier from "prettier";

import {
  NotionBlockType,
  type NotionBlock,
  type NotionBlockContents,
  type NotionRichText,
} from "~/definition/notion";
import { PRETTIER_CONFIG } from "~/definition/prettier";
import { fetchAndParseImage, saveImageInPublicDirectory } from "./image";

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
  isPriority = false,
}: {
  block: NotionBlock;
  isPriority?: boolean;
}): Promise<string> {
  const content = block[block.type] as NotionBlockContents;

  if (typeof content.type === "undefined") {
    return "";
  }

  const { url } = content[content.type] ?? {};
  const caption = content.caption?.[0]?.plain_text;

  if (!url) {
    return "";
  }

  const image = await fetchAndParseImage(url);
  const imagePath = await saveImageInPublicDirectory(image);

  return [
    "<figure>",
    "<img",
    `src="${imagePath}"`,
    caption ? `alt="${caption}"` : undefined,
    `decoding="${isPriority ? "sync" : "async"}"`,
    `loading="${isPriority ? "eager" : "lazy"}"`,
    `width="${image.width}"`,
    `height="${image.height}"`,
    "/>",
    caption ? `<figcaption>${caption}</figcaption>` : undefined,
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
        anchorLinks += "- " + content + "\n";
        break;

      case NotionBlockType.HEADING_THREE:
        prefix = "###";
        content = getTextContentFromBlock(block);
        anchorLinks += "  - " + content + "\n";
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
