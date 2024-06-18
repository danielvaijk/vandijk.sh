import { mkdir, writeFile } from "node:fs/promises";

import prettier from "prettier";

import { PRETTIER_CONFIG } from "~/definition/prettier";
import { NotionBlockType, type NotionChildPageBlock } from "~/definition/notion";
import {
  NOTION_ARTICLES_PAGE_ID,
  fetchNotionBlockChildren,
  fetchNotionPage,
} from "~/helpers/notion";
import { joinPathNames, slugify, determineOriginUrl } from "~/utilities/url";
import {
  convertBlocksToMarkup,
  generateMdxArticlePage,
  getImageContentFromBlock,
  generateImagesWithMarkup,
} from "~/helpers/markup";
import { fetchAndProcessImage, saveImage, ImagePurpose } from "~/helpers/image";

interface Article {
  id: string;
  title: string;
  date: Date;
  path: string;
}

const articlesPageResponse = await fetchNotionBlockChildren(NOTION_ARTICLES_PAGE_ID);
const articlesPageContents = articlesPageResponse.results;

const articles: Array<Article> = [];

for (let index = 0; index < articlesPageContents.length; index++) {
  const block = articlesPageContents[index];

  if (block.type !== NotionBlockType.CHILD_PAGE) {
    continue;
  }

  const childPageBlock = block as NotionChildPageBlock;
  const { title } = childPageBlock.child_page;

  // Skip articles with titles prefixed with "(WIP)."
  if (title.startsWith("(WIP)")) {
    continue;
  }

  articles.push({
    title,
    id: childPageBlock.id,
    date: new Date(childPageBlock.created_time),
    path: slugify(title),
  });
}

const originUrl = determineOriginUrl();

for (const { id: articleId, ...articleData } of articles) {
  const page = await fetchNotionPage(articleId);
  const { results: blocks } = await fetchNotionBlockChildren(articleId);
  const { articleContent, anchorLinks, readTime } = await convertBlocksToMarkup(blocks);

  const { cover, properties } = page;
  const coverCaption = properties.cover_alt.rich_text[0].plain_text;

  const coverImageContent = getImageContentFromBlock({
    // Convert the cover object into a "fake" block so it can be passed in here.
    block: { id: "", type: NotionBlockType.COVER, [NotionBlockType.COVER]: cover },
    captionOverride: coverCaption,
  });

  const coverImageData = await fetchAndProcessImage(
    coverImageContent.url,
    ImagePurpose.ARTICLE_COVER
  );

  const coverImagePublicPath = await saveImage(coverImageData);

  const coverImageMarkup = await generateImagesWithMarkup({
    isPriority: true,
    image: coverImageData,
    caption: coverImageContent.caption,
  });

  const { title, date } = articleData;
  const topic = properties.tags.multi_select[0].name;
  const description = properties.snippet.rich_text[0].plain_text ?? "";

  const articleRoute = slugify(title);
  const articleDirectory = joinPathNames("./src/routes/blog", articleRoute);
  const articleFilePath = joinPathNames(articleDirectory, "index.mdx");
  const articleMetadataPath = joinPathNames(articleDirectory, "meta.json");

  const pageUrl = joinPathNames(originUrl, "blog", articleRoute);

  const coverImage = {
    url: joinPathNames(originUrl, coverImagePublicPath),
    width: coverImageData.metadata.width,
    height: coverImageData.metadata.height,
    type: `image/${coverImageData.metadata.format}`,
    alt: coverImageContent.caption.text,
    markup: coverImageMarkup,
  };

  const articleMarkup = await prettier.format(
    generateMdxArticlePage({
      title,
      topic,
      date,
      description,
      pageUrl,
      readTime,
      coverImage,
      anchorLinks,
      articleContent,
    }),
    {
      parser: "mdx",
      // Don't wrap anything due to width limits, since MDX will wrap wrapped text
      // using a paragraph element, which causes unexpected markup inconsistencies.
      printWidth: Infinity,
    }
  );

  const articleMetadata = await prettier.format(
    JSON.stringify({
      ...articleData,
      coverImageMarkup,
      topic,
      description,
      readTime,
    }),
    {
      parser: "json",
      ...PRETTIER_CONFIG,
    }
  );

  await mkdir(articleDirectory, { recursive: true });
  await writeFile(articleFilePath, articleMarkup);
  await writeFile(articleMetadataPath, articleMetadata);
}

export {};
