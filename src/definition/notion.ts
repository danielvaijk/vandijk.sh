enum NotionBlockType {
  PARAGRAPH = "paragraph",
  CHILD_PAGE = "child_page",
  HEADING_ONE = "heading_1",
  HEADING_TWO = "heading_2",
  HEADING_THREE = "heading_3",
  BULLETED_LIST_ITEM = "bulleted_list_item",
  NUMBERED_LIST_ITEM = "numbered_list_item",
  IMAGE = "image",
  CODE = "code",
  COVER = "cover",
}

interface NotionBlock {
  id: string;
  type: NotionBlockType;
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

interface NotionMultiSelect {
  id: string;
  name: string;
  color: string;
}

interface NotionBlockContents {
  type?: "file" | "external";
  language?: string;
  file?: {
    url: string;
  };
  external?: {
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

export { NotionBlockType };
export type {
  NotionBlock,
  NotionRichText,
  NotionMultiSelect,
  NotionBlockContents,
  NotionChildPageBlock,
};
