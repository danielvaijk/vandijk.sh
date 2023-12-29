import { readFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import prettier from "prettier";
import { formatDateAsString } from "~/utilities/time";

const NOTION_API_VERSION = "2022-06-28";
const NOTION_API_TOKEN = `Bearer ${process.env.NOTION_TOKEN}`;
const NOTION_ARTICLES_PAGE_ID = "c15b7465-243e-4966-bfea-63789f645b04";

const PRETTIER_CONFIG = JSON.parse(await readFileSync(".prettierrc", { encoding: "utf-8" }));

enum BlockType {
  PARAGRAPH = "paragraph",
  CHILD_PAGE = "child_page",
  HEADING_ONE = "heading_1",
  HEADING_TWO = "heading_2",
  HEADING_THREE = "heading_3",
  BULLETED_LIST_ITEM = "bulleted_list_item",
  IMAGE = "image",
  CODE = "code",
}

interface Article {
  id: string;
  title: string;
  date: Date;
  path: string;
  description?: string;
}

interface NotionBlock {
  id: string;
  type: BlockType;
  [index: string]: unknown;
}

interface NotionRichText {
  annotations?: Record<string, boolean>;
  plain_text?: string;
  text?: {
    content: string;
    link?: {
      url: string;
    };
  };
}

interface NotionBlockContents {
  language?: string;
  external: {
    url: string;
  };
  caption?: Array<{
    plain_text?: string;
  }>;
  rich_text?: Array<NotionRichText>;
}

interface NotionChildPageBlock extends NotionBlock {
  last_edited_time: string;
  child_page: {
    title: string;
  };
}

interface NotionBlockChildrenResponse {
  object: string;
  has_more: boolean;
  next_cursor: string;
  results: Array<NotionBlock>;
}

interface NotionPageResponse {
  cover: {
    type: string;
    external: {
      url: string;
    };
  };
}

async function fetchPage(pageId: string): Promise<NotionPageResponse> {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": NOTION_API_TOKEN,
    "Notion-Version": NOTION_API_VERSION,
  };

  const request = await fetch(url, { headers });
  const response = await request.json();

  return response;
}

async function fetchBlockChildren(blockId: string): Promise<NotionBlockChildrenResponse> {
  const url = `https://api.notion.com/v1/blocks/${blockId}/children`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": NOTION_API_TOKEN,
    "Notion-Version": NOTION_API_VERSION,
  };

  const request = await fetch(url, { headers });
  const response = await request.json();

  return response;
}

function isNextIndexOfType(array: Array<NotionBlock>, index: number, type: BlockType) {
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

function getImageContentFromBlock(block: NotionBlock): string {
  const content = block[block.type] as NotionBlockContents;

  const { url } = content.external;
  const caption = content.caption?.[0].plain_text;

  return `![${caption}](${url})`;
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
      case BlockType.PARAGRAPH:
        content = getTextContentFromBlock(block);
        break;

      case BlockType.BULLETED_LIST_ITEM:
        prefix = "-";
        content = getTextContentFromBlock(block);
        spacer = isNextIndexOfType(blocks, index, BlockType.BULLETED_LIST_ITEM) ? "\n" : spacer;
        break;

      case BlockType.HEADING_ONE:
        prefix = "#";
        content = getTextContentFromBlock(block);
        break;

      case BlockType.HEADING_TWO:
        prefix = "##";
        content = getTextContentFromBlock(block);
        anchorLinks += "- " + content + "\n";
        break;

      case BlockType.HEADING_THREE:
        prefix = "###";
        content = getTextContentFromBlock(block);
        anchorLinks += "  - " + content + "\n";
        break;

      case BlockType.IMAGE:
        content = getImageContentFromBlock(block);
        break;

      case BlockType.CODE:
        content = await getCodeContentFromBlock(block);
        break;

      default:
        throw new Error(`Block type "${block.type}" is not supported.`);
    }

    if (content.length > 0) {
      if (prefix) {
        articleContent += prefix + " " + content + spacer;
      } else {
        articleContent += content + spacer;
      }
    }
  }

  return {
    articleContent,
    anchorLinks,
  };
}

function getRouteFromTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      // Replace all spaces with a dash.
      .replace(/\s+/g, "-")
      // Replace all non-word characters.
      .replace(/[^\w\\-]+/g, "")
      // Collapse repeated dashes.
      .replace(/\\-\\-+/g, "-")
  );
}

const articlesPageResponse = await fetchBlockChildren(NOTION_ARTICLES_PAGE_ID);
const articlesPageContents = articlesPageResponse.results;

const articles: Array<Article> = [];

for (let index = 0; index < articlesPageContents.length; index++) {
  const block = articlesPageContents[index];

  if (block.type === BlockType.CHILD_PAGE) {
    const childPageBlock = block as NotionChildPageBlock;
    const { title } = childPageBlock.child_page;

    const article: Article = {
      title,
      id: childPageBlock.id,
      date: new Date(childPageBlock.last_edited_time),
      path: getRouteFromTitle(title),
    };

    if (isNextIndexOfType(articlesPageContents, index, BlockType.PARAGRAPH)) {
      article.description = getTextContentFromBlock(articlesPageContents[index + 1]);
    }

    articles.push(article);
  }
}

for (const article of articles) {
  const page = await fetchPage(article.id);
  const { results: blocks } = await fetchBlockChildren(article.id);

  const articleRoute = getRouteFromTitle(article.title);
  const articleDirectory = path.join("./src/routes/articles", articleRoute);
  const articleFilePath = path.join(articleDirectory, "index.mdx");
  const articleMetadataPath = path.join(articleDirectory, "meta.json");

  const { articleContent, anchorLinks } = await convertBlocksToMarkup(blocks);

  const mdxContents = [
    "export default function Layout({ children: content }) {",
    "  return <article>{content}</article>;",
    "}",
    "",
    `![](${page.cover.external.url})`,
    "",
    `# ${article.title}`,
    "",
    `#### ${formatDateAsString(article.date)}`,
    "",
    anchorLinks,
    "",
    articleContent,
  ].join("\n");

  const metaContents = await prettier.format(JSON.stringify(article), {
    parser: "json",
    ...PRETTIER_CONFIG,
  });

  await mkdir(articleDirectory, { recursive: true });
  await writeFile(articleFilePath, mdxContents);
  await writeFile(articleMetadataPath, metaContents);
}

export {};
