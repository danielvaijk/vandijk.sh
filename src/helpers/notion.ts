import type {
  NotionBlock,
  NotionBlockType,
  NotionMultiSelect,
  NotionRichText,
} from "~/definition/notion";
import { joinPathNames } from "~/utilities/url";

interface NotionPageResponse {
  properties: {
    snippet: {
      rich_text: Array<NotionRichText>;
    };
    cover_alt: {
      rich_text: Array<NotionRichText>;
    };
    tags: {
      multi_select: Array<NotionMultiSelect>;
    };
  };
  cover: {
    type: string;
    external: {
      url: string;
    };
  };
}

interface NotionBlockChildrenResponse {
  object: string;
  has_more: boolean;
  next_cursor: string;
  results: Array<NotionBlock>;
}

const { NOTION_TOKEN } = process.env;
const NOTION_VERSION = "2022-06-28";
const NOTION_ARTICLES_PAGE_ID = "c15b7465-243e-4966-bfea-63789f645b04";

if (!NOTION_TOKEN) {
  throw new Error("Notion API token is missing.");
}

async function createNotionRequest<ResponseBody>(endpoint: string): Promise<ResponseBody> {
  const url = new URL(joinPathNames("https://api.notion.com/v1", endpoint));
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
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

function isNextIndexBlockOfType(array: Array<NotionBlock>, index: number, type: NotionBlockType) {
  return index < array.length - 1 && array[index + 1].type === type;
}

export {
  fetchNotionPage,
  fetchNotionBlockChildren,
  isNextIndexBlockOfType,
  NOTION_ARTICLES_PAGE_ID,
};
