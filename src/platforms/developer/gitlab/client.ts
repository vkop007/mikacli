import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";

import { AutoCliError } from "../../../errors.js";

const GITLAB_API_VERSION = "v4";
type FetchLike = typeof fetch;

export type GitLabUser = {
  id: number;
  username: string;
  name: string;
  web_url: string;
  avatar_url?: string | null;
  state?: string;
  bio?: string | null;
  location?: string | null;
  public_email?: string | null;
  created_at?: string;
};

export type GitLabProject = {
  id: number;
  description?: string | null;
  name: string;
  name_with_namespace?: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  visibility?: string;
  star_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  default_branch?: string | null;
  archived?: boolean;
  last_activity_at?: string;
  created_at?: string;
};

export type GitLabIssue = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description?: string | null;
  state: string;
  web_url: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  author?: {
    username?: string;
    name?: string;
  };
  labels?: string[];
  comments_count?: number;
};

export type GitLabMergeRequest = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description?: string | null;
  state: string;
  web_url: string;
  created_at?: string;
  updated_at?: string;
  merged_at?: string | null;
  draft?: boolean;
  work_in_progress?: boolean;
  source_branch?: string;
  target_branch?: string;
  author?: {
    username?: string;
    name?: string;
  };
  labels?: string[];
  comments_count?: number;
  merge_status?: string;
  has_conflicts?: boolean;
};

type GitLabListResponse<T> = T[];

export class GitLabWebClient {
  private readonly cookieFetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  private readonly baseUrl: string;

  constructor(input: { jar?: CookieJar; baseUrl?: string; fetchImpl?: FetchLike }) {
    this.baseUrl = normalizeBaseUrl(input.baseUrl ?? "https://gitlab.com/api/v4");
    this.cookieFetch = makeFetchCookie(input.fetchImpl ?? fetch, input.jar ?? new CookieJar(), true);
  }

  async getMe(): Promise<GitLabUser> {
    return this.request<GitLabUser>("/user");
  }

  async listProjects(input: { query?: string; limit?: number }): Promise<GitLabProject[]> {
    const url = new URL(`${this.baseUrl}/projects`);
    url.searchParams.set("simple", "true");
    url.searchParams.set("membership", "true");
    url.searchParams.set("order_by", "last_activity_at");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    if (input.query) {
      url.searchParams.set("search", input.query);
    }

    return this.requestAbsolute<GitLabListResponse<GitLabProject>>(url);
  }

  async searchProjects(input: { query: string; limit?: number }): Promise<GitLabProject[]> {
    const url = new URL(`${this.baseUrl}/projects`);
    url.searchParams.set("simple", "true");
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    url.searchParams.set("search", input.query);

    return this.requestAbsolute<GitLabListResponse<GitLabProject>>(url);
  }

  async getProject(target: string): Promise<GitLabProject> {
    return this.request<GitLabProject>(`/projects/${encodeURIComponent(target)}`);
  }

  async listIssues(input: { project: string; state?: string; limit?: number }): Promise<GitLabIssue[]> {
    const url = new URL(`${this.baseUrl}/projects/${encodeURIComponent(input.project)}/issues`);
    url.searchParams.set("state", input.state ?? "opened");
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    return this.requestAbsolute<GitLabListResponse<GitLabIssue>>(url);
  }

  async getIssue(input: { project: string; iid: number }): Promise<GitLabIssue> {
    return this.request<GitLabIssue>(`/projects/${encodeURIComponent(input.project)}/issues/${input.iid}`);
  }

  async createIssue(input: { project: string; title: string; description?: string }): Promise<GitLabIssue> {
    return this.request<GitLabIssue>(`/projects/${encodeURIComponent(input.project)}/issues`, {
      method: "POST",
      body: {
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
      },
    });
  }

  async listMergeRequests(input: { project: string; state?: string; limit?: number }): Promise<GitLabMergeRequest[]> {
    const url = new URL(`${this.baseUrl}/projects/${encodeURIComponent(input.project)}/merge_requests`);
    url.searchParams.set("state", input.state ?? "opened");
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    return this.requestAbsolute<GitLabListResponse<GitLabMergeRequest>>(url);
  }

  async getMergeRequest(input: { project: string; iid: number }): Promise<GitLabMergeRequest> {
    return this.request<GitLabMergeRequest>(`/projects/${encodeURIComponent(input.project)}/merge_requests/${input.iid}`);
  }

  private async request<T>(path: string, init?: { method?: string; body?: Record<string, unknown> }): Promise<T> {
    const response = await this.cookieFetch(`${this.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: this.buildHeaders(init?.body !== undefined),
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });

    if (!response.ok) {
      throw await this.toGitLabError(response);
    }

    return (await this.parseJson<T>(response, path)) as T;
  }

  private async requestAbsolute<T>(url: URL): Promise<T> {
    const response = await this.cookieFetch(url.toString(), {
      method: "GET",
      headers: this.buildHeaders(false),
    });

    if (!response.ok) {
      throw await this.toGitLabError(response);
    }

    return (await this.parseJson<T>(response, url.toString())) as T;
  }

  private buildHeaders(includeJsonContentType: boolean): HeadersInit {
    return {
      accept: "application/json",
      ...(includeJsonContentType ? { "content-type": "application/json" } : {}),
      "user-agent": "AutoCLI",
      "X-GitLab-Api-Version": GITLAB_API_VERSION,
    };
  }

  private async parseJson<T>(response: Response, url: string): Promise<T> {
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new AutoCliError("GITLAB_RESPONSE_INVALID", "GitLab returned a non-JSON response.", {
        cause: error,
        details: {
          url,
          status: response.status,
          preview: text.slice(0, 200),
        },
      });
    }
  }

  private async toGitLabError(response: Response): Promise<AutoCliError> {
    let bodyText = "";
    let payload: Record<string, unknown> | undefined;

    try {
      bodyText = await response.text();
      payload = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : undefined;
    } catch {
      payload = undefined;
    }

    const upstreamMessage = extractUpstreamMessage(payload) ?? (bodyText || response.statusText);
    const code =
      response.status === 401 ? "GITLAB_SESSION_INVALID"
      : response.status === 403 ? "GITLAB_FORBIDDEN"
      : response.status === 404 ? "GITLAB_NOT_FOUND"
      : response.status === 409 ? "GITLAB_CONFLICT"
      : response.status === 422 || response.status === 400 ? "GITLAB_VALIDATION_FAILED"
      : response.status === 429 ? "GITLAB_RATE_LIMITED"
      : "GITLAB_REQUEST_FAILED";

    const message =
      code === "GITLAB_SESSION_INVALID" ? "GitLab rejected the saved web session. Re-import fresh cookies."
      : code === "GITLAB_FORBIDDEN" ? "GitLab denied access to that resource."
      : code === "GITLAB_NOT_FOUND" ? "GitLab could not find that resource."
      : code === "GITLAB_CONFLICT" ? "GitLab reported a conflict while processing the request."
      : code === "GITLAB_RATE_LIMITED" ? "GitLab rate limited the request. Try again later."
      : code === "GITLAB_VALIDATION_FAILED" ? `GitLab rejected the request: ${upstreamMessage}`
      : `GitLab API request failed with HTTP ${response.status}.`;

    return new AutoCliError(code, message, {
      details: {
        status: response.status,
        statusText: response.statusText,
        upstreamMessage,
      },
    });
  }
}

export { GitLabWebClient as GitLabApiClient };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractUpstreamMessage(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) {
    return undefined;
  }

  const message = payload.message;
  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    const joined = message
      .map((item) => (typeof item === "string" ? item : ""))
      .filter((item) => item.length > 0)
      .join(", ");
    if (joined.length > 0) {
      return joined;
    }
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  return undefined;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/u, "");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (withProtocol.endsWith("/api/v4")) {
    return withProtocol;
  }

  return `${withProtocol}/api/v4`;
}
