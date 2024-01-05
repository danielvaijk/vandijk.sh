import path from "path";
import { mkdir, writeFile } from "fs/promises";

import prettier from "prettier";

import { PRETTIER_CONFIG } from "~/definition/prettier";
import { NotionBlockType, type NotionChildPageBlock } from "~/definition/notion";
import { formatDateAsString } from "~/utilities/time";
import {
  NOTION_ARTICLES_PAGE_ID,
  fetchNotionBlockChildren,
  fetchNotionPage,
} from "~/helpers/notion";
import { getRouteFromText } from "~/helpers/url";
import {
  convertBlocksToMarkup,
  getAndStoreImageContentFromBlock,
  getTextContentFromBlock,
  isNextIndexBlockOfType,
} from "~/helpers/markup";

interface Article {
  id: string;
  title: string;
  date: Date;
  path: string;
  description?: string;
}

const articlesPageResponse = await fetchNotionBlockChildren(NOTION_ARTICLES_PAGE_ID);
const articlesPageContents = articlesPageResponse.results;

const articles: Array<Article> = [];

for (let index = 0; index < articlesPageContents.length; index++) {
  const block = articlesPageContents[index];

  if (block.type === NotionBlockType.CHILD_PAGE) {
    const childPageBlock = block as NotionChildPageBlock;
    const { title } = childPageBlock.child_page;

    if (title.startsWith("(WIP)")) {
      continue;
    }

    const article: Article = {
      title,
      id: childPageBlock.id,
      date: new Date(childPageBlock.last_edited_time),
      path: getRouteFromText(title),
    };

    if (isNextIndexBlockOfType(articlesPageContents, index, NotionBlockType.PARAGRAPH)) {
      article.description = getTextContentFromBlock(articlesPageContents[index + 1]);
    }

    articles.push(article);
  }
}

for (const article of articles) {
  const page = await fetchNotionPage(article.id);
  const { results: blocks } = await fetchNotionBlockChildren(article.id);
  const { articleContent, anchorLinks } = await convertBlocksToMarkup(blocks);

  const articleRoute = getRouteFromText(article.title);
  const articleDirectory = path.join("./src/routes/articles", articleRoute);
  const articleFilePath = path.join(articleDirectory, "index.mdx");
  const articleMetadataPath = path.join(articleDirectory, "meta.json");

  // Format the page cover data to be compatible with the existing image
  // content utility function: getAndStoreImageContentFromBlock.
  const pageCoverAsBlock = {
    id: "",
    type: NotionBlockType.COVER,
    [NotionBlockType.COVER]: page.cover,
  };

  const mdxContents = await prettier.format(
    [
      "---",
      `title: "${article.title}"`,
      `description: "${article.description}"`,
      "---",
      "",
      "export default function Layout({ children: content }) {",
      "  return <article>{content}</article>;",
      "}",
      "",
      await getAndStoreImageContentFromBlock({
        block: pageCoverAsBlock,
        captionOverride: "Article cover image",
        isPriority: true,
      }),
      "",
      `# ${article.title}`,
      "",
      `#### ${formatDateAsString(article.date)}`,
      "",
      anchorLinks,
      "",
      articleContent,
    ].join("\n"),
    {
      parser: "mdx",
    }
  );

  const metaContents = await prettier.format(JSON.stringify(article), {
    parser: "json",
    ...PRETTIER_CONFIG,
  });

  await mkdir(articleDirectory, { recursive: true });
  await writeFile(articleFilePath, mdxContents);
  await writeFile(articleMetadataPath, metaContents);
}

export {};
