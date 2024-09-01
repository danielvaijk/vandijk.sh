// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type {
  NotionBlock,
  NotionBlockType,
  NotionMultiSelect,
  NotionRichText,
} from "src/definition/notion";
import { joinPathNames } from "src/utilities/url";

interface NotionResponse {
  has_more: boolean;
  next_cursor: string;
  // Object: string;
  results: Array<unknown>;
}

interface NotionPageResponse extends NotionResponse {
  cover: {
    external: {
      url: string;
    };
    type: string;
  };
  properties: {
    cover_alt: {
      rich_text: Array<NotionRichText>;
    };
    snippet: {
      rich_text: Array<NotionRichText>;
    };
    tags: {
      multi_select: Array<NotionMultiSelect>;
    };
  };
}

interface NotionBlockChildrenResponse extends NotionResponse {
  object: string;
  results: Array<NotionBlock>;
}

const NOTION_VERSION = "2022-06-28";
const NOTION_ARTICLES_PAGE_ID = "c15b7465-243e-4966-bfea-63789f645b04";

function getNotionToken(): string {
  const { NOTION_TOKEN } = process.env;

  if (typeof NOTION_TOKEN === "undefined") {
    throw new Error("Notion API token is missing.");
  } else {
    return NOTION_TOKEN;
  }
}

async function createNotionRequest<ResponseBody extends NotionResponse>(
  endpoint: string
): Promise<ResponseBody> {
  const url = new URL(joinPathNames("https://api.notion.com/v1", endpoint));
  const headers = {
    "Authorization": `Bearer ${getNotionToken()}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };

  // eslint-disable-next-line @typescript-eslint/init-declarations -- Intentionally undefined.
  let response;

  do {
    if (response?.has_more === true) {
      url.searchParams.set("start_cursor", response.next_cursor);
    }

    console.debug(`Sending GET request to ${url.toString()}`);

    const currentRequest = await fetch(url, { headers });
    const currentResponse = (await currentRequest.json()) as ResponseBody;

    if (typeof response !== "undefined") {
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

function isNextIndexBlockOfType(
  array: Array<NotionBlock>,
  index: number,
  type: NotionBlockType
): boolean {
  return index < array.length - 1 && array[index + 1].type === type;
}

export {
  fetchNotionPage,
  fetchNotionBlockChildren,
  isNextIndexBlockOfType,
  NOTION_ARTICLES_PAGE_ID,
};
