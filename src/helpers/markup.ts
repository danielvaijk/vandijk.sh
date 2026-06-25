import {
  ImageFormat,
  createImageVariants,
  type ProcessedImage,
  type ImageSourceSet,
  createSourceSetFromImageVariants,
  serializeSourceSet,
} from "src/helpers/image";
import { formatDateAsString } from "src/utilities/time";

interface ImageCaption {
  altText: string;
  isHidden: boolean;
  theme?: string;
}

interface GenerateImagesWithMarkupOptions {
  caption: ImageCaption;
  image: ProcessedImage;
  isPriority?: boolean;
  publicPath?: string;
}

function extractCaptionValues(captionRaw: string): ImageCaption {
  const caption: ImageCaption = {
    altText: captionRaw,
    isHidden: false,
  };

  const prefixRegex = /^\s*(?:\((?<prefixValues>.*?)\))?\s*(?<altText>.*)$/u;
  const prefixMatch = prefixRegex.exec(captionRaw);

  if (prefixMatch !== null) {
    const [, prefixContent, altText] = prefixMatch;

    if (typeof prefixContent !== "undefined") {
      for (const prefixValue of prefixContent.split(",")) {
        switch (prefixValue.trim()) {
          case "HIDDEN":
            caption.isHidden = true;
            break;
          case "DARK":
            caption.theme = "dark";
            break;
          case "LIGHT":
            caption.theme = "light";
            break;
          default:
            break;
        }
      }
    }

    caption.altText = altText;
  }

  return caption;
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
  const alt = `alt="${caption.altText}"`;

  const img = `<img ${src} ${width} ${height} ${alt} ${decoding} ${loading} />`;
  const figcaption = caption.isHidden ? null : `<figcaption>${caption.altText}</figcaption>`;
  let figureOpenTag = "<figure>";

  if (typeof caption.theme !== "undefined") {
    figureOpenTag = `<figure class="${caption.theme}-only">`;
  }

  if (isSingleImage) {
    return [figureOpenTag, img, figcaption, "</figure>"]
      .filter((value): boolean => value !== null)
      .join("\n");
  }

  const sizes = `sizes="(max-width: 46rem) 90vw, 46rem"`;
  const avifSourceSet = `srcset="${serializeSourceSet(avifSources)}"`;
  const webpSourceSet = `srcset="${serializeSourceSet(webpSources)}"`;

  return [
    figureOpenTag,
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
    webpSourceSet,
  });
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
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
author: Daniel van Dijk
opengraph:
  - title: true
  - description: true
  - type: article
  - url: ${pageUrl}
  - article:author: Daniel van Dijk
  - article:published_time: ${date.toISOString()}
  - tag: ${JSON.stringify(topic)}
  - locale: en_US
  - site_name: Daniel van Dijk
  - image: ${coverImage.url}
    image:alt: ${JSON.stringify(coverImage.alt)}
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

export { extractCaptionValues, generateMdxArticlePage, generateImagesWithMarkup };
