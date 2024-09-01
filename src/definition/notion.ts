// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

enum NotionBlockType {
  BULLETED_LIST_ITEM = "bulleted_list_item",
  CHILD_PAGE = "child_page",
  CODE = "code",
  COVER = "cover",
  HEADING_ONE = "heading_1",
  HEADING_THREE = "heading_3",
  HEADING_TWO = "heading_2",
  IMAGE = "image",
  NUMBERED_LIST_ITEM = "numbered_list_item",
  PARAGRAPH = "paragraph",
}

interface NotionBlock {
  [index: string]: unknown;
  id: string;
  type: NotionBlockType;
}

interface NotionRichText {
  annotations?: { [key: string]: boolean };
  plain_text?: string;
  text?: {
    content: string;
    link: {
      url: string;
    } | null;
  };
}

interface NotionMultiSelect {
  color: string;
  id: string;
  name: string;
}

interface NotionBlockContents {
  caption?: Array<{
    plain_text?: string;
  }>;
  external?: {
    url: string;
  };
  file?: {
    url: string;
  };
  language?: string;
  rich_text?: Array<NotionRichText>;
  type?: "file" | "external";
}

interface NotionChildPageBlock extends NotionBlock {
  child_page: {
    title: string;
  };
  created_time: string;
}

export { NotionBlockType };
export type {
  NotionBlock,
  NotionRichText,
  NotionMultiSelect,
  NotionBlockContents,
  NotionChildPageBlock,
};
