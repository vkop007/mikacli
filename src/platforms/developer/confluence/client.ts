import { MikaCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import {
  buildConfluencePageUrl,
  buildConfluenceSpaceUrl,
  confluenceStorageFromPlainText,
  normalizeConfluencePageTarget,
  normalizeConfluenceSiteUrl,
  normalizeConfluenceSpaceTarget,
  summarizeConfluenceStorageHtml,
} from "./helpers.js";

type ConfluenceUserProfile = {
  profilePicture?: { path?: string; isDefault?: boolean };
  displayName?: string;
  email?: string;
  publicName?: string;
};

export type ConfluenceUser = {
  type?: string;
  accountType?: string;
  accountId: string;
  displayName?: string;
  publicName?: string;
  email?: string;
  profilePicture?: { path?: string; isDefault?: boolean };
};

export type ConfluenceSpace = {
  id: string;
  key: string;
  name: string;
  type?: string;
  status?: string;
  description?: {
    plain?: {
      value?: string;
    };
  };
  homepage?: {
    id?: string;
    title?: string;
  };
};

type ConfluenceSpaceListResponse = {
  results?: ConfluenceSpace[];
};

export type ConfluencePage = {
  id: string;
  type?: string;
  status?: string;
  title: string;
  space?: ConfluenceSpace;
  version?: {
    number?: number;
    when?: string;
    by?: ConfluenceUserProfile;
  };
  body?: {
    storage?: {
      value?: string;
      representation?: string;
    };
  };
  ancestors?: Array<{
    id: string;
    title?: string;
    type?: string;
  }>;
  _links?: {
    webui?: string;
    tinyui?: string;
  };
};

type ConfluenceContentListResponse = {
  results?: ConfluencePage[];
};

export type ConfluenceComment = {
  id: string;
  type?: string;
  status?: string;
  body?: {
    storage?: {
      value?: string;
    };
  };
  version?: {
    when?: string;
    by?: ConfluenceUserProfile;
  };
  _links?: {
    webui?: string;
  };
};

export class ConfluenceWebClient {
  readonly siteUrl: string;

  constructor(
    private readonly http: SessionHttpClient,
    siteUrl: string,
  ) {
    this.siteUrl = normalizeConfluenceSiteUrl(siteUrl);
  }

  async getViewer(): Promise<ConfluenceUser> {
    return this.request<ConfluenceUser>("/rest/api/user/current");
  }

  async listSpaces(input: { query?: string; limit?: number }): Promise<ConfluenceSpace[]> {
    const url = new URL(`${this.siteUrl}/rest/api/space`);
    url.searchParams.set("limit", String(clamp(input.limit ?? 20, 1, 100)));
    url.searchParams.set("expand", "description.plain,homepage");
    const response = await this.requestAbsolute<ConfluenceSpaceListResponse>(url.toString());
    const spaces = response.results ?? [];
    const query = input.query?.trim().toLowerCase();
    if (!query) {
      return spaces;
    }

    return spaces.filter((space) =>
      [space.key, space.name, space.description?.plain?.value]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }

  async searchPages(input: { query: string; space?: string; limit?: number }): Promise<ConfluencePage[]> {
    const cqlParts = [`type = page`, `siteSearch ~ ${quoteConfluenceString(input.query)}`];
    if (input.space?.trim()) {
      cqlParts.push(`space = ${quoteConfluenceString(normalizeConfluenceSpaceTarget(input.space))}`);
    }

    const url = new URL(`${this.siteUrl}/rest/api/content/search`);
    url.searchParams.set("cql", cqlParts.join(" AND "));
    url.searchParams.set("limit", String(clamp(input.limit ?? 20, 1, 100)));
    url.searchParams.set("expand", "space,version");
    const response = await this.requestAbsolute<ConfluenceContentListResponse>(url.toString());
    return response.results ?? [];
  }

  async getPage(target: string): Promise<ConfluencePage> {
    const pageId = normalizeConfluencePageTarget(target);
    const url = new URL(`${this.siteUrl}/rest/api/content/${encodeURIComponent(pageId)}`);
    url.searchParams.set("expand", "space,version,body.storage,ancestors");
    return this.requestAbsolute<ConfluencePage>(url.toString());
  }

  async listChildren(target: string, limit?: number): Promise<ConfluencePage[]> {
    const pageId = normalizeConfluencePageTarget(target);
    const url = new URL(`${this.siteUrl}/rest/api/content/${encodeURIComponent(pageId)}/child/page`);
    url.searchParams.set("limit", String(clamp(limit ?? 20, 1, 100)));
    url.searchParams.set("expand", "space,version");
    const response = await this.requestAbsolute<ConfluenceContentListResponse>(url.toString());
    return response.results ?? [];
  }

  async createPage(input: { space: string; title: string; body?: string; parentId?: string }): Promise<ConfluencePage> {
    const title = input.title.trim();
    if (!title) {
      throw new MikaCliError("CONFLUENCE_TITLE_REQUIRED", "Confluence page title cannot be empty.");
    }

    const body = confluenceStorageFromPlainText(input.body) ?? "<p></p>";
    const response = await this.request<ConfluencePage>("/rest/api/content", {
      method: "POST",
      expectedStatus: [200, 201],
      body: {
        type: "page",
        title,
        space: {
          key: normalizeConfluenceSpaceTarget(input.space),
        },
        ...(input.parentId ? { ancestors: [{ id: normalizeConfluencePageTarget(input.parentId) }] } : {}),
        body: {
          storage: {
            value: body,
            representation: "storage",
          },
        },
      },
    });

    return this.getPage(response.id);
  }

  async updatePage(input: { target: string; title?: string; body?: string; minorEdit?: boolean }): Promise<ConfluencePage> {
    const page = await this.getPage(input.target);
    const nextTitle = input.title?.trim() || page.title;
    const nextBody = input.body?.trim() ? confluenceStorageFromPlainText(input.body) : page.body?.storage?.value ?? "<p></p>";
    const versionNumber = typeof page.version?.number === "number" ? page.version.number + 1 : 1;

    await this.request<ConfluencePage>(`/rest/api/content/${encodeURIComponent(page.id)}`, {
      method: "PUT",
      expectedStatus: [200],
      body: {
        id: page.id,
        type: "page",
        title: nextTitle,
        status: "current",
        space: {
          key: page.space?.key,
        },
        version: {
          number: versionNumber,
          minorEdit: Boolean(input.minorEdit),
        },
        body: {
          storage: {
            value: nextBody,
            representation: "storage",
          },
        },
      },
    });

    return this.getPage(page.id);
  }

  async createComment(input: { target: string; text: string }): Promise<ConfluenceComment> {
    const pageId = normalizeConfluencePageTarget(input.target);
    const body = confluenceStorageFromPlainText(input.text);
    if (!body) {
      throw new MikaCliError("CONFLUENCE_COMMENT_REQUIRED", "Confluence comment text cannot be empty.");
    }

    return this.request<ConfluenceComment>(`/rest/api/content/${encodeURIComponent(pageId)}/child/comment`, {
      method: "POST",
      expectedStatus: [200, 201],
      body: {
        type: "comment",
        container: {
          type: "page",
          id: pageId,
        },
        body: {
          storage: {
            value: body,
            representation: "storage",
          },
        },
      },
    });
  }

  summarizeSpace(space: ConfluenceSpace): Record<string, unknown> {
    return {
      id: space.id,
      key: space.key,
      name: space.name,
      type: space.type,
      status: space.status,
      description: space.description?.plain?.value,
      homepageId: space.homepage?.id,
      homepageTitle: space.homepage?.title,
      url: buildConfluenceSpaceUrl(this.siteUrl, space.key),
    };
  }

  summarizePage(page: ConfluencePage): Record<string, unknown> {
    const bodyHtml = page.body?.storage?.value;
    return {
      id: page.id,
      title: page.title,
      type: page.type,
      status: page.status,
      spaceKey: page.space?.key,
      spaceName: page.space?.name,
      url: resolveConfluencePageUrl(this.siteUrl, page),
      updatedAt: page.version?.when,
      updatedBy: page.version?.by?.displayName ?? page.version?.by?.publicName,
      version: page.version?.number,
      bodyText: summarizeConfluenceStorageHtml(bodyHtml),
      ancestors: Array.isArray(page.ancestors)
        ? page.ancestors.map((ancestor) => ({
            id: ancestor.id,
            title: ancestor.title,
            type: ancestor.type,
            url: buildConfluencePageUrl(this.siteUrl, ancestor.id),
          }))
        : undefined,
    };
  }

  summarizeComment(comment: ConfluenceComment, pageId: string): Record<string, unknown> {
    return {
      id: comment.id,
      type: comment.type,
      status: comment.status,
      url: comment._links?.webui ? `${this.siteUrl}${comment._links.webui}` : buildConfluencePageUrl(this.siteUrl, pageId),
      createdAt: comment.version?.when,
      author: comment.version?.by?.displayName ?? comment.version?.by?.publicName,
      bodyText: summarizeConfluenceStorageHtml(comment.body?.storage?.value),
    };
  }

  private async request<T>(
    path: string,
    input: {
      method?: string;
      body?: Record<string, unknown>;
      expectedStatus?: number[];
    } = {},
  ): Promise<T> {
    return this.requestAbsolute<T>(`${this.siteUrl}${path}`, input);
  }

  private async requestAbsolute<T>(
    url: string,
    input: {
      method?: string;
      body?: Record<string, unknown>;
      expectedStatus?: number[];
    } = {},
  ): Promise<T> {
    try {
      const { data } = await this.http.requestWithResponse<string>(url, {
        method: input.method ?? "GET",
        responseType: "text",
        expectedStatus: input.expectedStatus ?? [200],
        headers: {
          accept: "application/json",
          ...(input.body ? { "content-type": "application/json" } : {}),
          "x-atlassian-token": "no-check",
          "x-requested-with": "XMLHttpRequest",
          "user-agent": "MikaCLI",
        },
        ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      });

      const text = data.trim();
      if (!text) {
        return {} as T;
      }

      if (text.startsWith("<")) {
        throw new MikaCliError("CONFLUENCE_SESSION_INVALID", "Confluence redirected the saved web session to an HTML page. Re-import fresh cookies.", {
          details: {
            url,
            preview: text.slice(0, 200),
          },
        });
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new MikaCliError("CONFLUENCE_RESPONSE_INVALID", "Confluence returned a non-JSON response.", {
          cause: error,
          details: {
            url,
            preview: text.slice(0, 200),
          },
        });
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): MikaCliError {
    if (!(error instanceof MikaCliError)) {
      return new MikaCliError("CONFLUENCE_REQUEST_FAILED", "Confluence request failed.", { cause: error });
    }

    if (error.code !== "HTTP_REQUEST_FAILED") {
      return error;
    }

    const status = typeof error.details?.status === "number" ? error.details.status : undefined;
    const body = typeof error.details?.body === "string" ? error.details.body : "";
    const message = extractConfluenceUpstreamMessage(body);

    const code =
      status === 400 || status === 422 ? "CONFLUENCE_VALIDATION_FAILED"
      : status === 401 ? "CONFLUENCE_SESSION_INVALID"
      : status === 403 ? "CONFLUENCE_FORBIDDEN"
      : status === 404 ? "CONFLUENCE_NOT_FOUND"
      : status === 429 ? "CONFLUENCE_RATE_LIMITED"
      : "CONFLUENCE_REQUEST_FAILED";

    const friendly =
      code === "CONFLUENCE_SESSION_INVALID" ? "Confluence rejected the saved web session."
      : code === "CONFLUENCE_FORBIDDEN" ? "Confluence denied this action for the current web session."
      : code === "CONFLUENCE_NOT_FOUND" ? "Confluence could not find the requested page or space."
      : code === "CONFLUENCE_RATE_LIMITED" ? "Confluence rate limited the current web session. Try again shortly."
      : code === "CONFLUENCE_VALIDATION_FAILED" ? message || "Confluence rejected the request payload."
      : message || "Confluence request failed.";

    return new MikaCliError(code, friendly, {
      details: {
        ...(error.details ?? {}),
        upstreamMessage: message || undefined,
      },
    });
  }
}

function resolveConfluencePageUrl(siteUrl: string, page: ConfluencePage): string {
  if (page._links?.webui) {
    return `${normalizeConfluenceSiteUrl(siteUrl)}${page._links.webui}`;
  }

  return buildConfluencePageUrl(siteUrl, page.id);
}

function extractConfluenceUpstreamMessage(body: string): string | undefined {
  if (!body.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
      reason?: unknown;
      data?: { errors?: Array<{ message?: unknown }> };
    };

    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      return parsed.message;
    }
    if (typeof parsed.reason === "string" && parsed.reason.length > 0) {
      return parsed.reason;
    }
    const nested = parsed.data?.errors?.find((entry) => typeof entry.message === "string")?.message;
    if (typeof nested === "string" && nested.length > 0) {
      return nested;
    }
  } catch {
    return body.trim().slice(0, 200);
  }

  return undefined;
}

function quoteConfluenceString(value: string): string {
  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
