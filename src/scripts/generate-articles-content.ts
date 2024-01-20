import { mkdir, writeFile } from "node:fs/promises";

import prettier from "prettier";

import { PRETTIER_CONFIG } from "~/definition/prettier";
import { NotionBlockType, type NotionChildPageBlock } from "~/definition/notion";
import { formatDateAsString } from "~/utilities/time";
import {
  NOTION_ARTICLES_PAGE_ID,
  fetchNotionBlockChildren,
  fetchNotionPage,
  isNextIndexBlockOfType,
} from "~/helpers/notion";
import { joinPathNames, slugify, determineOriginUrl } from "~/utilities/url";
import {
  convertBlocksToMarkup,
  createMarkupForImage,
  getImageContentFromBlock,
  getRichTextContentFromBlock,
} from "~/helpers/markup";
import {
  ImageFormat,
  type ImageMetadata,
  createImageVariants,
  createSourceSetsFromImageVariants,
  fetchAndProcessImage,
  saveImage,
  ImagePurpose,
} from "~/helpers/image";

interface Article {
  id: string;
  title: string;
  date: Date;
  path: string;
  description?: string;
}

const originUrl = determineOriginUrl();

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
      path: slugify(title),
    };

    if (isNextIndexBlockOfType(articlesPageContents, index, NotionBlockType.PARAGRAPH)) {
      article.description = getRichTextContentFromBlock(articlesPageContents[index + 1]);
    }

    articles.push(article);
  }
}

for (const article of articles) {
  const page = await fetchNotionPage(article.id);
  const { results: blocks } = await fetchNotionBlockChildren(article.id);
  const { articleContent, anchorLinks } = await convertBlocksToMarkup(blocks);

  const articleRoute = slugify(article.title);
  const articleDirectory = joinPathNames("./src/routes/articles", articleRoute);
  const articleFilePath = joinPathNames(articleDirectory, "index.mdx");
  const articleMetadataPath = joinPathNames(articleDirectory, "meta.json");

  const coverImageContent = getImageContentFromBlock({
    // Convert the cover object into a "fake" block so it can be pass in here.
    block: { id: "", type: NotionBlockType.COVER, [NotionBlockType.COVER]: page.cover },
    captionOverride: "(HIDDEN) Article cover image.",
  });

  const coverImageData = await fetchAndProcessImage(
    coverImageContent.url,
    ImagePurpose.ARTICLE_COVER
  );

  const options = {
    isPriority: true,
    image: coverImageData,
    caption: coverImageContent.caption,
  };

  const getOpenGraphMetadataForImage = (metadata: ImageMetadata, publicPath: string) =>
    [
      `  - image: ${joinPathNames(originUrl, publicPath)}`,
      `    image:alt: ${coverImageContent.caption.text}`,
      `    image:type: image/${metadata.format}`,
      `    image:width: ${metadata.width}`,
      `    image:height: ${metadata.height}`,
    ].join("\n");

  let coverImageMarkup;

  const coverImagePublicPath = await saveImage(coverImageData);
  const coverImageOpenGraphMetadata = getOpenGraphMetadataForImage(
    coverImageData.metadata,
    coverImagePublicPath
  );

  if (coverImageData.willUseOriginal) {
    coverImageMarkup = createMarkupForImage({ ...options, publicPath: coverImagePublicPath });
  } else {
    const avifVariants = await createImageVariants(coverImageData, ImageFormat.AVIF);
    const webpVariants = await createImageVariants(coverImageData, ImageFormat.WEBP);

    const avifSourceSets = await createSourceSetsFromImageVariants(avifVariants);
    const webpSourceSets = await createSourceSetsFromImageVariants(webpVariants);

    coverImageMarkup = createMarkupForImage({
      ...options,
      avifSourceSets,
      webpSourceSets,
      // Default/fallback is the smallest WebP cover image variant.
      publicPath: webpSourceSets[0].path,
    });
  }

  const mdxContents = await prettier.format(
    [
      "---",
      `title: "${article.title}"`,
      `description: "${article.description}"`,
      "author: Daniel van Dijk",
      "opengraph:",
      "  - title: true",
      "  - description: true",
      "  - type: article",
      `  - url: ${joinPathNames(originUrl, "articles", articleRoute)}`,
      "  - article:author: Daniel van Dijk",
      `  - article:published_time: ${article.date.toISOString()}`,
      "  - locale: en_US",
      "  - site_name: Daniel van Dijk",
      coverImageOpenGraphMetadata,
      "---",
      "",
      "export default function Layout({ children: content }) {",
      "  return <article>{content}</article>;",
      "}",
      "",
      coverImageMarkup,
      "",
      `# ${article.title}`,
      "",
      `<div role="doc-subtitle">${formatDateAsString(article.date)}</div>`,
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
