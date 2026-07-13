declare module "virtual:articles" {
  interface ArticleMetadata {
    coverImageFramesPath?: string;
    coverImageMarkup: string;
    date: string;
    description: string;
    path: string;
    readTime: number;
    title: string;
    topic: string;
  }

  const articles: ArticleMetadata[];

  export default articles;
}

declare module "virtual:glyph-frame-posters" {
  interface GlyphFramePoster {
    aspectRatio: number;
    cols: number;
    data: string;
    rows: number;
  }

  const posters: Record<string, GlyphFramePoster>;

  export default posters;
}
