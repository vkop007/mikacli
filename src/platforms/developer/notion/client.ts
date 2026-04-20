import { MikaCliError } from "../../../errors.js";
import { buildNotionPageUrl } from "./helpers.js";
import { SessionHttpClient } from "../../../utils/http-client.js";

import type { NotionSemanticString } from "./helpers.js";

const NOTION_WEB_API_BASE_URL = "https://www.notion.so/api/v3";

type NotionRole = "reader" | "editor" | "comment_only" | "none" | string;

type NotionRecord<T> = {
  role: NotionRole;
  value?: T;
};

type NotionRecordMap<T> = Record<string, NotionRecord<T>>;

export interface NotionWebUser {
  id: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  profile_photo?: string;
}

export interface NotionWebSpace {
  id: string;
  name?: string;
  domain?: string;
}

export interface NotionWebUserRoot {
  id: string;
  space_view_pointers?: Array<{
    spaceId?: string;
  }>;
}

export interface NotionWebBlock {
  id: string;
  type: string;
  properties?: Record<string, NotionSemanticString | undefined>;
  content?: string[];
  view_ids?: string[];
  collection_id?: string;
  parent_id: string;
  parent_table: string;
  created_by_id?: string;
  created_time?: number;
  last_edited_by?: string;
  last_edited_by_id?: string;
  last_edited_time?: number;
  alive: boolean;
  discussions?: string[];
  space_id?: string;
}

export interface NotionWebCollectionProperty {
  name: string;
  type: string;
  options?: Array<{
    id: string;
    color?: string;
    value: string;
  }>;
}

export interface NotionWebCollection {
  id: string;
  name?: [[string]];
  description?: NotionSemanticString;
  schema: Record<string, NotionWebCollectionProperty>;
  parent_id: string;
  parent_table: string;
  alive: boolean;
}

export interface NotionWebCollectionView {
  id: string;
  type: string;
  name?: string;
  page_sort?: string[];
  alive: boolean;
}

export interface NotionWebDiscussion {
  id: string;
  resolved?: boolean;
  space_id: string;
  parent_id: string;
  parent_table: string;
  context?: NotionSemanticString;
  comments?: string[];
}

export interface NotionWebComment {
  id: string;
  alive: boolean;
  space_id: string;
  parent_id: string;
  parent_table: string;
  created_by_id: string;
  created_time: number;
  last_edited_time: number;
  text: NotionSemanticString;
}

export interface NotionWebRecordMapShape {
  block?: NotionRecordMap<NotionWebBlock>;
  collection?: NotionRecordMap<NotionWebCollection>;
  collection_view?: NotionRecordMap<NotionWebCollectionView>;
  notion_user?: NotionRecordMap<NotionWebUser>;
  user_root?: NotionRecordMap<NotionWebUserRoot>;
  space?: NotionRecordMap<NotionWebSpace>;
  discussion?: NotionRecordMap<NotionWebDiscussion>;
  comment?: NotionRecordMap<NotionWebComment>;
}

interface LoadUserContentResponse {
  recordMap: NotionWebRecordMapShape;
}

interface SearchResult {
  id: string;
}

interface SearchResponse {
  recordMap: NotionWebRecordMapShape;
  results: SearchResult[];
}

interface LoadPageChunkResponse {
  cursor?: {
    stack: Array<Array<{ table: string; id: string; index: number }>>;
  };
  recordMap: NotionWebRecordMapShape;
}

interface QueryCollectionResponse {
  result?: {
    reducerResults?: Record<
      string,
      | {
          type: "results";
          blockIds?: string[];
          total?: number;
        }
      | {
          type: "aggregation";
          aggregationResult?: unknown;
        }
    >;
  };
  recordMap: NotionWebRecordMapShape;
}

interface GetRecordValuesResponse<T> {
  results: Array<NotionRecord<T>>;
}

type NotionOperation = {
  id: string;
  table: string;
  path: string[];
  command: "set" | "update" | "listAfter" | "listBefore" | "listRemove";
  args: unknown;
};

export class NotionWebClient {
  constructor(
    private readonly http: SessionHttpClient,
    private readonly options: {
      activeUserId?: string;
    } = {},
  ) {}

  async loadUserContent(): Promise<LoadUserContentResponse> {
    return this.request<LoadUserContentResponse>("/loadUserContent", {});
  }

  async getCurrentContext(): Promise<{
    recordMap: NotionWebRecordMapShape;
    user: NotionWebUser;
    userId: string;
    space?: NotionWebSpace;
    spaceId?: string;
  }> {
    const response = await this.loadUserContent();
    const recordMap = response.recordMap ?? {};
    const users = recordMap.notion_user ?? {};
    const preferredUserId = this.options.activeUserId;
    const userId =
      (preferredUserId && users[preferredUserId]?.value ? preferredUserId : undefined) ??
      Object.keys(users)[0];

    if (!userId || !users[userId]?.value) {
      throw new MikaCliError("NOTION_SESSION_INVALID", "Notion did not return an authenticated user for the imported session.");
    }

    const user = users[userId].value;
    const spaceId =
      recordMap.user_root?.[userId]?.value?.space_view_pointers?.find((pointer) => typeof pointer.spaceId === "string")?.spaceId ??
      Object.keys(recordMap.space ?? {})[0];

    return {
      recordMap,
      user,
      userId,
      spaceId,
      space: spaceId ? recordMap.space?.[spaceId]?.value : undefined,
    };
  }

  async search(input: {
    query?: string;
    spaceId?: string;
    limit?: number;
  }): Promise<SearchResponse> {
    return this.request<SearchResponse>("/search", {
      type: "BlocksInSpace",
      query: input.query ?? "",
      spaceId: input.spaceId,
      limit: clamp(input.limit ?? 20, 1, 100),
      filters: {
        isDeletedOnly: false,
        excludeTemplates: false,
        isNavigableOnly: false,
        requireEditPermissions: false,
        ancestors: [],
        createdBy: [],
        editedBy: [],
        lastEditedTime: {},
        createdTime: {},
      },
      sort: {
        field: "relevance",
      },
      source: "quick_find",
    });
  }

  async loadPage(pageId: string): Promise<LoadPageChunkResponse> {
    return this.request<LoadPageChunkResponse>("/loadPageChunk", {
      pageId,
      limit: 100,
      cursor: {
        stack: [],
      },
      chunkNumber: 0,
      verticalColumns: false,
    });
  }

  async getBlock(blockId: string): Promise<NotionWebBlock> {
    return this.getSingleRecord("block", blockId);
  }

  async getCollection(collectionId: string): Promise<NotionWebCollection> {
    return this.getSingleRecord("collection", collectionId);
  }

  async getCollectionView(collectionViewId: string): Promise<NotionWebCollectionView> {
    return this.getSingleRecord("collection_view", collectionViewId);
  }

  async queryCollection(input: {
    collectionId: string;
    collectionViewId: string;
    spaceId?: string;
    userId?: string;
    search?: string;
    limit?: number;
  }): Promise<QueryCollectionResponse> {
    return this.request<QueryCollectionResponse>("/queryCollection", {
      collectionView: {
        id: input.collectionViewId,
        ...(input.spaceId ? { spaceId: input.spaceId } : {}),
      },
      loader: {
        reducers: {
          collection_group_results: {
            type: "results",
            limit: clamp(input.limit ?? 20, 1, 100),
          },
        },
        sort: [],
        searchQuery: input.search ?? "",
        ...(input.userId ? { userId: input.userId } : {}),
        userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
      source: {
        id: input.collectionId,
        ...(input.spaceId ? { spaceId: input.spaceId } : {}),
        type: "collection",
      },
    });
  }

  async submitTransaction(operations: NotionOperation[]): Promise<void> {
    await this.request<Record<string, never>>("/submitTransaction", {
      operations,
    });
  }

  buildUpdateLastEditedOperation(userId: string, blockId: string): NotionOperation {
    return {
      id: blockId,
      table: "block",
      path: [],
      command: "update",
      args: {
        last_edited_by_id: userId,
        last_edited_by_table: "notion_user",
        last_edited_time: Date.now(),
      },
    };
  }

  createBlockRecord(input: {
    id: string;
    parentId: string;
    parentTable: string;
    spaceId: string;
    userId: string;
    type: string;
    properties?: Record<string, NotionSemanticString>;
  }): NotionOperation {
    return {
      id: input.id,
      table: "block",
      path: [],
      command: "set",
      args: {
        id: input.id,
        version: 1,
        alive: true,
        created_by_id: input.userId,
        created_by_table: "notion_user",
        created_time: Date.now(),
        parent_id: input.parentId,
        parent_table: input.parentTable,
        space_id: input.spaceId,
        type: input.type,
        ...(input.properties ? { properties: input.properties } : {}),
      },
    };
  }

  createDiscussionRecord(input: {
    id: string;
    pageId: string;
    spaceId: string;
    commentId: string;
  }): NotionOperation {
    return {
      id: input.id,
      table: "discussion",
      path: [],
      command: "set",
      args: {
        id: input.id,
        version: 1,
        resolved: false,
        space_id: input.spaceId,
        parent_id: input.pageId,
        parent_table: "block",
        context: [[""]],
        comments: [input.commentId],
      },
    };
  }

  createCommentRecord(input: {
    id: string;
    discussionId: string;
    spaceId: string;
    userId: string;
    text: NotionSemanticString;
  }): NotionOperation {
    const now = Date.now();
    return {
      id: input.id,
      table: "comment",
      path: [],
      command: "set",
      args: {
        id: input.id,
        version: 1,
        alive: true,
        space_id: input.spaceId,
        parent_id: input.discussionId,
        parent_table: "discussion",
        created_by_id: input.userId,
        created_by_table: "notion_user",
        created_time: now,
        last_edited_time: now,
        text: input.text,
      },
    };
  }

  addChildBlockOperation(input: {
    parentId: string;
    parentTable?: string;
    blockId: string;
    after?: string;
    childListKey?: string;
  }): NotionOperation {
    return {
      id: input.parentId,
      table: input.parentTable ?? "block",
      path: [input.childListKey ?? "content"],
      command: "listAfter",
      args: {
        ...(input.after ? { after: input.after } : {}),
        id: input.blockId,
      },
    };
  }

  removeChildBlockOperation(input: {
    parentId: string;
    parentTable?: string;
    blockId: string;
    childListKey?: string;
  }): NotionOperation {
    return {
      id: input.parentId,
      table: input.parentTable ?? "block",
      path: [input.childListKey ?? "content"],
      command: "listRemove",
      args: {
        id: input.blockId,
      },
    };
  }

  updateRecordOperation(input: {
    id: string;
    table?: string;
    args: Record<string, unknown>;
  }): NotionOperation {
    return {
      id: input.id,
      table: input.table ?? "block",
      path: [],
      command: "update",
      args: input.args,
    };
  }

  setRecordPathOperation(input: {
    id: string;
    table?: string;
    path: string[];
    args: unknown;
  }): NotionOperation {
    return {
      id: input.id,
      table: input.table ?? "block",
      path: input.path,
      command: "set",
      args: input.args,
    };
  }

  private async getSingleRecord<T>(table: string, id: string): Promise<T> {
    const response = await this.request<GetRecordValuesResponse<T>>("/getRecordValues", {
      requests: [{ id, table }],
    });
    const record = response.results?.[0];
    if (!record?.value) {
      throw new MikaCliError("NOTION_NOT_FOUND", "Notion could not find that resource or the session cannot access it.", {
        details: {
          table,
          id,
        },
      });
    }

    return record.value;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    try {
      return await this.http.request<T>(`${NOTION_WEB_API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json",
          origin: "https://www.notion.so",
          referer: "https://www.notion.so/",
          "user-agent": DEFAULT_NOTION_USER_AGENT,
          ...(this.options.activeUserId ? { "x-notion-active-user-header": this.options.activeUserId } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw this.toNotionError(error, path);
    }
  }

  private toNotionError(error: unknown, path: string): MikaCliError {
    if (error instanceof MikaCliError && error.code === "HTTP_REQUEST_FAILED") {
      const status = typeof error.details?.status === "number" ? error.details.status : undefined;
      const body = typeof error.details?.body === "string" ? error.details.body : undefined;

      if (status === 401 || status === 403) {
        return new MikaCliError("NOTION_SESSION_INVALID", "Notion rejected the saved web session. Re-import fresh cookies.", {
          details: {
            path,
            status,
            body,
          },
        });
      }

      if (status === 404) {
        return new MikaCliError("NOTION_NOT_FOUND", "Notion could not find that resource or the session cannot access it.", {
          details: {
            path,
            status,
            body,
          },
        });
      }

      if (status === 429) {
        return new MikaCliError("NOTION_RATE_LIMITED", "Notion rate limited the request. Try again in a moment.", {
          details: {
            path,
            status,
            body,
          },
        });
      }

      return new MikaCliError("NOTION_WEB_REQUEST_FAILED", `Notion web request failed on ${path}.`, {
        details: {
          path,
          status,
          body,
        },
        cause: error,
      });
    }

    if (error instanceof MikaCliError) {
      return error;
    }

    return new MikaCliError("NOTION_WEB_REQUEST_FAILED", `Notion web request failed on ${path}.`, {
      details: {
        path,
        message: error instanceof Error ? error.message : String(error),
      },
      cause: error,
    });
  }
}

export function buildNotionBlockUrl(blockId: string): string {
  return buildNotionPageUrl(blockId);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const DEFAULT_NOTION_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
