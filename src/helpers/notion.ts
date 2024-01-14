import type { NotionBlock } from "~/definition/notion";
import { joinPathNames } from "~/utilities/url";

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
  const url = new URL(joinPathNames("https://api.notion.com/v1", endpoint));
  const headers = {
    "Content-Type": "application/json",
    "Authorization": NOTION_API_TOKEN,
    "Notion-Version": NOTION_API_VERSION,
  };

  let response;

  do {
    if (response?.has_more) {
      url.searchParams.set("start_cursor", response.next_cursor);
    }

    console.debug(`Sending GET request to ${url.toString()}`);

    const currentRequest = await fetch(url, { headers });
    const currentResponse = await currentRequest.json();

    if (response) {
      response = {
        ...currentResponse,
        results: [...response.results, ...currentResponse.results],
      };
    } else {
      response = currentResponse;
    }
  } while (response.has_more);

  return response;
}

async function fetchNotionPage(pageId: string): Promise<NotionPageResponse> {
  return createNotionRequest(`/pages/${pageId}`);
}

async function fetchNotionBlockChildren(blockId: string): Promise<NotionBlockChildrenResponse> {
  return createNotionRequest(`/blocks/${blockId}/children`);
}

export { fetchNotionPage, fetchNotionBlockChildren, NOTION_ARTICLES_PAGE_ID };
