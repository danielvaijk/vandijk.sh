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
