declare module "virtual:articles" {
  import type { ArticleSummaryProps } from "src/components/article-summary-item";

  const articles: Array<ArticleSummaryProps>;
  export default articles;
}
