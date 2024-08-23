import { mkdir, writeFile } from "node:fs/promises";

import prettierConfig from "@danielvaijk/prettier-config";
import prettier from "prettier";

import { NotionBlockType, type NotionChildPageBlock } from "src/definition/notion";
import { fetchAndProcessImage, saveImage, ImagePurpose } from "src/helpers/image";
import {
  convertBlocksToMarkup,
  generateMdxArticlePage,
  getImageContentFromBlock,
  generateImagesWithMarkup,
} from "src/helpers/markup";
import {
  NOTION_ARTICLES_PAGE_ID,
  fetchNotionBlockChildren,
  fetchNotionPage,
} from "src/helpers/notion";
import { joinPathNames, slugify, determineOriginUrl } from "src/utilities/url";

interface Article {
  date: Date;
  id: string;
  path: string;
  title: string;
}

const articlesPageResponse = await fetchNotionBlockChildren(NOTION_ARTICLES_PAGE_ID);
const articlesPageContents = articlesPageResponse.results;

const articles: Array<Article> = [];

for (const block of articlesPageContents) {
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
    date: new Date(childPageBlock.created_time),
    id: childPageBlock.id,
    path: slugify(title),
    title,
  });
}

const originUrl = determineOriginUrl();

for (const { id: articleId, ...articleData } of articles) {
  const page = await fetchNotionPage(articleId);
  const { results: blocks } = await fetchNotionBlockChildren(articleId);
  const { anchorLinks, articleContent, readTime } = await convertBlocksToMarkup(blocks);

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
    caption: coverImageContent.caption,
    image: coverImageData,
    isPriority: true,
  });

  const { date, title } = articleData;
  const topic = properties.tags.multi_select[0].name;
  const description = properties.snippet.rich_text[0].plain_text ?? "";

  const articleRoute = slugify(title);
  const articleDirectory = joinPathNames("./src/routes/blog", articleRoute);
  const articleFilePath = joinPathNames(articleDirectory, "index.mdx");
  const articleMetadataPath = joinPathNames(articleDirectory, "meta.json");

  const pageUrl = joinPathNames(originUrl, "blog", articleRoute);

  const coverImage = {
    alt: coverImageContent.caption.altText,
    height: coverImageData.metadata.height,
    markup: coverImageMarkup,
    type: `image/${coverImageData.metadata.format}`,
    url: joinPathNames(originUrl, coverImagePublicPath),
    width: coverImageData.metadata.width,
  };

  const articleMarkup = await prettier.format(
    generateMdxArticlePage({
      anchorLinks,
      articleContent,
      coverImage,
      date,
      description,
      pageUrl,
      readTime,
      title,
      topic,
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
      description,
      readTime,
      topic,
    }),
    {
      parser: "json",
      ...prettierConfig,
    }
  );

  await mkdir(articleDirectory, { recursive: true });
  await writeFile(articleFilePath, articleMarkup);
  await writeFile(articleMetadataPath, articleMetadata);
}

export {};
