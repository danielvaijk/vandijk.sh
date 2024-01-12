import type { NotionBlock } from "~/definition/notion";
import { joinPathNames } from "~/utilities/path";

const NOTION_API_VERSION = "2022-06-28";
const NOTION_API_TOKEN = `Bearer ${process.env.NOTION_TOKEN}`;
const NOTION_ARTICLES_PAGE_ID = "c15b7465-243e-4966-bfea-63789f645b04";

interface NotionBlockChildrenResponse {
  object: string;
  has_more: boolean;
  next_cursor: string;
  results: Array<NotionBlock>;
}

interface NotionPageResponse {
  cover: {
    type: string;
    external: {
      url: string;
    };
  };
}

async function createNotionRequest<ResponseBody>(endpoint: string): Promise<ResponseBody> {
  const url = joinPathNames("https://api.notion.com/v1", endpoint);
  const headers = {
    "Content-Type": "application/json",
    "Authorization": NOTION_API_TOKEN,
    "Notion-Version": NOTION_API_VERSION,
  };

  const request = await fetch(url, { headers });
  const response = await request.json();

  return response;
}

async function fetchNotionPage(pageId: string): Promise<NotionPageResponse> {
  return createNotionRequest(`/pages/${pageId}`);
}

async function fetchNotionBlockChildren(blockId: string): Promise<NotionBlockChildrenResponse> {
  return createNotionRequest(`/blocks/${blockId}/children`);
}

export { fetchNotionPage, fetchNotionBlockChildren, NOTION_ARTICLES_PAGE_ID };
