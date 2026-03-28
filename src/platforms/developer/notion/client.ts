import { AutoCliError } from "../../../errors.js";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";

type FetchLike = typeof fetch;

export type NotionUser = {
  object: "user";
  id: string;
  type?: string;
  name?: string | null;
  avatar_url?: string | null;
  person?: {
    email?: string;
  };
  bot?: {
    workspace_name?: string | null;
    owner?: {
      type?: string;
      workspace?: boolean;
      user?: {
        object?: string;
        id?: string;
        name?: string | null;
      };
    };
  };
};

export type NotionPage = {
  object: "page";
  id: string;
  created_time?: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  url?: string;
  icon?: unknown;
  cover?: unknown;
  parent?: Record<string, unknown>;
  properties?: Record<string, unknown>;
};

export type NotionDataSource = {
  object: "data_source";
  id: string;
  created_time?: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  url?: string;
  title?: Array<Record<string, unknown>>;
  description?: Array<Record<string, unknown>>;
  properties?: Record<string, unknown>;
};

export type NotionComment = {
  object: "comment";
  id: string;
  created_time?: string;
  last_edited_time?: string;
  discussion_id?: string;
  parent?: Record<string, unknown>;
  rich_text?: Array<Record<string, unknown>>;
  created_by?: {
    id?: string;
    name?: string | null;
  };
};

export type NotionSearchItem = NotionPage | NotionDataSource;

type NotionListResponse<T> = {
  object: "list";
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
};

export class NotionApiClient {
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(input: { token: string; fetchImpl?: FetchLike }) {
    this.token = input.token;
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  async getSelf(): Promise<NotionUser> {
    return this.request<NotionUser>("/users/me", {
      method: "GET",
    });
  }

  async search(input: { query?: string; object?: "page" | "data_source"; limit?: number; startCursor?: string }): Promise<NotionListResponse<NotionSearchItem>> {
    const body: Record<string, unknown> = {};
    if (typeof input.query === "string" && input.query.trim().length > 0) {
      body.query = input.query.trim();
    }
    if (input.object) {
      body.filter = {
        property: "object",
        value: input.object,
      };
    }
    if (typeof input.limit === "number") {
      body.page_size = clamp(input.limit, 1, 100);
    }
    if (typeof input.startCursor === "string" && input.startCursor.trim().length > 0) {
      body.start_cursor = input.startCursor.trim();
    }

    return this.request<NotionListResponse<NotionSearchItem>>("/search", {
      method: "POST",
      body,
    });
  }

  async getPage(pageId: string): Promise<NotionPage> {
    return this.request<NotionPage>(`/pages/${pageId}`, {
      method: "GET",
    });
  }

  async createPage(input: {
    parent: { page_id?: string; data_source_id?: string };
    properties: Record<string, unknown>;
    children?: Array<Record<string, unknown>>;
  }): Promise<NotionPage> {
    return this.request<NotionPage>("/pages", {
      method: "POST",
      body: {
        parent: input.parent,
        properties: input.properties,
        ...(input.children && input.children.length > 0 ? { children: input.children } : {}),
      },
    });
  }

  async updatePage(input: {
    pageId: string;
    properties?: Record<string, unknown>;
    archived?: boolean;
    inTrash?: boolean;
  }): Promise<NotionPage> {
    return this.request<NotionPage>(`/pages/${input.pageId}`, {
      method: "PATCH",
      body: {
        ...(input.properties ? { properties: input.properties } : {}),
        ...(typeof input.archived === "boolean" ? { archived: input.archived } : {}),
        ...(typeof input.inTrash === "boolean" ? { in_trash: input.inTrash } : {}),
      },
    });
  }

  async appendBlockChildren(blockId: string, children: Array<Record<string, unknown>>): Promise<NotionListResponse<Record<string, unknown>>> {
    return this.request<NotionListResponse<Record<string, unknown>>>(`/blocks/${blockId}/children`, {
      method: "PATCH",
      body: {
        children,
      },
    });
  }

  async getDataSource(dataSourceId: string): Promise<NotionDataSource> {
    return this.request<NotionDataSource>(`/data_sources/${dataSourceId}`, {
      method: "GET",
    });
  }

  async queryDataSource(input: { dataSourceId: string; limit?: number; startCursor?: string }): Promise<NotionListResponse<NotionPage>> {
    const body: Record<string, unknown> = {};
    if (typeof input.limit === "number") {
      body.page_size = clamp(input.limit, 1, 100);
    }
    if (typeof input.startCursor === "string" && input.startCursor.trim().length > 0) {
      body.start_cursor = input.startCursor.trim();
    }

    return this.request<NotionListResponse<NotionPage>>(`/data_sources/${input.dataSourceId}/query`, {
      method: "POST",
      body,
    });
  }

  async createComment(input: { pageId: string; richText: Array<Record<string, unknown>> }): Promise<NotionComment> {
    return this.request<NotionComment>("/comments", {
      method: "POST",
      body: {
        parent: {
          page_id: input.pageId,
        },
        rich_text: input.richText,
      },
    });
  }

  private async request<T>(path: string, init: { method: string; body?: Record<string, unknown> }): Promise<T> {
    const response = await this.fetchImpl(`${NOTION_API_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "notion-version": NOTION_VERSION,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    if (!response.ok) {
      throw await this.toNotionError(response);
    }

    return (await response.json()) as T;
  }

  private async toNotionError(response: Response): Promise<AutoCliError> {
    let bodyText = "";
    let payload: Record<string, unknown> | undefined;

    try {
      bodyText = await response.text();
      payload = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : undefined;
    } catch {
      payload = undefined;
    }

    const upstreamCode = typeof payload?.code === "string" ? payload.code : undefined;
    const upstreamMessage = typeof payload?.message === "string" ? payload.message : bodyText || response.statusText;

    const code =
      response.status === 401 ? "NOTION_TOKEN_INVALID"
      : response.status === 403 ? "NOTION_FORBIDDEN"
      : response.status === 404 ? "NOTION_NOT_FOUND"
      : response.status === 429 ? "NOTION_RATE_LIMITED"
      : response.status === 400 ? "NOTION_VALIDATION_FAILED"
      : "NOTION_REQUEST_FAILED";

    const message =
      code === "NOTION_TOKEN_INVALID" ? "Notion rejected the supplied token."
      : code === "NOTION_FORBIDDEN" ? "Notion denied access. Share the page or data source with the integration and retry."
      : code === "NOTION_NOT_FOUND" ? "Notion could not find that resource or the integration does not have access to it."
      : code === "NOTION_RATE_LIMITED" ? "Notion rate limited the request. Try again in a moment."
      : code === "NOTION_VALIDATION_FAILED" ? `Notion rejected the request: ${upstreamMessage}`
      : `Notion API request failed with HTTP ${response.status}.`;

    return new AutoCliError(code, message, {
      details: {
        status: response.status,
        statusText: response.statusText,
        upstreamCode,
        upstreamMessage,
      },
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

