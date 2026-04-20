import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";

import { MikaCliError } from "../../../errors.js";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_HOME_URL = "https://github.com/";
const GITHUB_SETTINGS_PROFILE_URL = "https://github.com/settings/profile";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type GitHubClientAuth =
  | {
      kind: "apiKey";
      token: string;
    }
  | {
      kind: "cookies";
      jar: CookieJar;
    };

export type GitHubViewer = {
  id: number;
  login: string;
  name: string | null;
  html_url: string;
  avatar_url: string;
  email: string | null;
  public_repos: number;
  followers: number;
  following: number;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
};

export type GitHubUser = GitHubViewer;

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  owner: {
    login: string;
  };
  visibility?: string;
  archived?: boolean;
  disabled?: boolean;
  updated_at?: string;
};

export type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  body: string | null;
  comments: number;
  created_at: string;
  updated_at: string;
  user?: {
    login?: string;
  };
  pull_request?: Record<string, unknown>;
};

export type GitHubIssueComment = {
  id: number;
  html_url: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    login?: string;
  };
};

export type GitHubBranch = {
  name: string;
  protected: boolean;
  commit: {
    sha: string;
    url: string;
  };
};

export type GitHubPullRequest = {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  body: string | null;
  comments: number;
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  draft?: boolean;
  user?: {
    login?: string;
  };
  head?: {
    ref?: string;
  };
  base?: {
    ref?: string;
  };
};

export type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  body: string | null;
};

export type GitHubReadme = {
  name: string;
  path: string;
  sha: string;
  size: number;
  html_url: string;
  download_url: string | null;
  content?: string;
  encoding?: string;
};

type GitHubSearchResponse<T> = {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
};

export class GitHubApiClient {
  private readonly auth: GitHubClientAuth;
  private readonly fetchImpl: FetchLike;
  private csrfToken?: string;
  private csrfTokenLoaded = false;

  constructor(input: { token: string; fetchImpl?: FetchLike } | { jar: CookieJar; fetchImpl?: FetchLike }) {
    const fetchImpl = input.fetchImpl ?? fetch;

    if ("token" in input) {
      this.auth = {
        kind: "apiKey",
        token: input.token,
      };
    } else {
      this.auth = {
        kind: "cookies",
        jar: input.jar,
      };
    }

    this.fetchImpl = fetchImpl;
    if (this.auth.kind === "cookies") {
      this.fetchImpl = makeFetchCookie(fetchImpl, this.auth.jar, true);
    }
  }

  async getViewer(): Promise<GitHubViewer> {
    if (this.auth.kind === "cookies") {
      return this.getViewerFromWebSession();
    }

    return this.request<GitHubViewer>("/user");
  }

  async getUser(login: string): Promise<GitHubUser> {
    return this.request<GitHubUser>(`/users/${encodeURIComponent(login)}`);
  }

  async listViewerRepos(input: { limit?: number; type?: string; sort?: string }): Promise<GitHubRepo[]> {
    const url = new URL(`${GITHUB_API_BASE_URL}/user/repos`);
    url.searchParams.set("per_page", String(clamp(input.limit ?? 30, 1, 100)));
    if (input.type) {
      url.searchParams.set("type", input.type);
    }
    if (input.sort) {
      url.searchParams.set("sort", input.sort);
    }

    return this.requestAbsolute<GitHubRepo[]>(url);
  }

  async listUserRepos(input: { owner: string; limit?: number; sort?: string }): Promise<GitHubRepo[]> {
    const url = new URL(`${GITHUB_API_BASE_URL}/users/${encodeURIComponent(input.owner)}/repos`);
    url.searchParams.set("per_page", String(clamp(input.limit ?? 30, 1, 100)));
    if (input.sort) {
      url.searchParams.set("sort", input.sort);
    }

    return this.requestAbsolute<GitHubRepo[]>(url);
  }

  async getRepo(fullName: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${fullName}`);
  }

  async listStarredRepos(input: { owner?: string; limit?: number; sort?: string; direction?: string }): Promise<GitHubRepo[]> {
    const path = input.owner ? `/users/${encodeURIComponent(input.owner)}/starred` : "/user/starred";
    const url = new URL(`${GITHUB_API_BASE_URL}${path}`);
    url.searchParams.set("per_page", String(clamp(input.limit ?? 30, 1, 100)));
    if (input.sort) {
      url.searchParams.set("sort", input.sort);
    }
    if (input.direction) {
      url.searchParams.set("direction", input.direction);
    }

    return this.requestAbsolute<GitHubRepo[]>(url);
  }

  async listBranches(input: { fullName: string; limit?: number }): Promise<GitHubBranch[]> {
    const url = new URL(`${GITHUB_API_BASE_URL}/repos/${input.fullName}/branches`);
    url.searchParams.set("per_page", String(clamp(input.limit ?? 30, 1, 100)));
    return this.requestAbsolute<GitHubBranch[]>(url);
  }

  async getBranch(input: { fullName: string; branch: string }): Promise<GitHubBranch> {
    return this.request<GitHubBranch>(`/repos/${input.fullName}/branches/${encodeURIComponent(input.branch)}`);
  }

  async listPulls(input: { fullName: string; state?: string; limit?: number; sort?: string; direction?: string }): Promise<GitHubPullRequest[]> {
    const url = new URL(`${GITHUB_API_BASE_URL}/repos/${input.fullName}/pulls`);
    url.searchParams.set("state", input.state ?? "open");
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    if (input.sort) {
      url.searchParams.set("sort", input.sort);
    }
    if (input.direction) {
      url.searchParams.set("direction", input.direction);
    }
    return this.requestAbsolute<GitHubPullRequest[]>(url);
  }

  async getPull(input: { fullName: string; pullNumber: number }): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${input.fullName}/pulls/${input.pullNumber}`);
  }

  async listReleases(input: { fullName: string; limit?: number }): Promise<GitHubRelease[]> {
    const url = new URL(`${GITHUB_API_BASE_URL}/repos/${input.fullName}/releases`);
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    return this.requestAbsolute<GitHubRelease[]>(url);
  }

  async getReadme(fullName: string): Promise<GitHubReadme> {
    return this.request<GitHubReadme>(`/repos/${fullName}/readme`);
  }

  async searchRepos(input: {
    query: string;
    limit?: number;
    sort?: string;
    order?: string;
  }): Promise<GitHubSearchResponse<GitHubRepo>> {
    const url = new URL(`${GITHUB_API_BASE_URL}/search/repositories`);
    url.searchParams.set("q", input.query);
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    if (input.sort) {
      url.searchParams.set("sort", input.sort);
    }
    if (input.order) {
      url.searchParams.set("order", input.order);
    }

    return this.requestAbsolute<GitHubSearchResponse<GitHubRepo>>(url);
  }

  async listIssues(input: { fullName: string; state?: string; limit?: number }): Promise<GitHubIssue[]> {
    const url = new URL(`${GITHUB_API_BASE_URL}/repos/${input.fullName}/issues`);
    url.searchParams.set("state", input.state ?? "open");
    url.searchParams.set("per_page", String(clamp(input.limit ?? 20, 1, 100)));
    return this.requestAbsolute<GitHubIssue[]>(url);
  }

  async getIssue(input: { fullName: string; issueNumber: number }): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${input.fullName}/issues/${input.issueNumber}`);
  }

  async createIssue(input: { fullName: string; title: string; body?: string }): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${input.fullName}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        ...(input.body ? { body: input.body } : {}),
      }),
    });
  }

  async createIssueComment(input: { fullName: string; issueNumber: number; body: string }): Promise<GitHubIssueComment> {
    return this.request<GitHubIssueComment>(`/repos/${input.fullName}/issues/${input.issueNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: input.body,
      }),
    });
  }

  async createRepo(input: { name: string; description?: string; private?: boolean; homepage?: string; autoInit?: boolean }): Promise<GitHubRepo> {
    return this.request<GitHubRepo>("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        ...(typeof input.private === "boolean" ? { private: input.private } : {}),
        ...(input.homepage ? { homepage: input.homepage } : {}),
        ...(typeof input.autoInit === "boolean" ? { auto_init: input.autoInit } : {}),
      }),
    });
  }

  async forkRepo(fullName: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${fullName}/forks`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async starRepo(fullName: string): Promise<void> {
    await this.requestVoid(`/user/starred/${fullName}`, {
      method: "PUT",
      headers: {
        "content-length": "0",
      },
    });
  }

  async unstarRepo(fullName: string): Promise<void> {
    await this.requestVoid(`/user/starred/${fullName}`, {
      method: "DELETE",
    });
  }

  private async getViewerFromWebSession(): Promise<GitHubViewer> {
    const response = await this.fetchImpl(GITHUB_SETTINGS_PROFILE_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "MikaCLI",
      },
    });

    if (response.url.includes("/login")) {
      throw new MikaCliError("GITHUB_SESSION_INVALID", "GitHub rejected the saved web session.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
        },
      });
    }

    const html = await response.text();
    const parsedViewer = extractViewerFromSettingsHtml(html);
    if (!parsedViewer.login) {
      throw new MikaCliError("GITHUB_VIEWER_PARSE_FAILED", "GitHub settings loaded, but MikaCLI could not determine the signed-in account.", {
        details: {
          url: response.url,
        },
      });
    }

    try {
      const publicViewer = await this.request<GitHubUser>(`/users/${encodeURIComponent(parsedViewer.login)}`);
      return {
        ...publicViewer,
        id: parsedViewer.id ?? publicViewer.id,
        login: parsedViewer.login,
        name: parsedViewer.name ?? publicViewer.name,
        html_url: parsedViewer.html_url ?? publicViewer.html_url,
        avatar_url: parsedViewer.avatar_url ?? publicViewer.avatar_url,
        email: parsedViewer.email ?? publicViewer.email,
      };
    } catch {
      return {
        id: parsedViewer.id ?? 0,
        login: parsedViewer.login,
        name: parsedViewer.name ?? null,
        html_url: parsedViewer.html_url ?? `${GITHUB_HOME_URL}${parsedViewer.login}`,
        avatar_url: parsedViewer.avatar_url ?? "",
        email: parsedViewer.email ?? null,
        public_repos: 0,
        followers: 0,
        following: 0,
      };
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(`${GITHUB_API_BASE_URL}${path}`);
    return this.requestAbsolute<T>(url, init);
  }

  private async requestAbsolute<T>(url: URL, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: await this.buildHeaders(init, url),
    });

    const raw = await response.text();
    const parsed = raw.length > 0 ? tryParseJson(raw) : undefined;

    if (!response.ok) {
      throw new MikaCliError(this.mapErrorCode(response.status), this.buildErrorMessage(response.status, parsed), {
        details: {
          status: response.status,
          statusText: response.statusText,
          url: url.toString(),
          body: parsed ?? raw,
        },
      });
    }

    return (parsed ?? {}) as T;
  }

  private async requestVoid(path: string, init: RequestInit = {}): Promise<void> {
    const url = new URL(`${GITHUB_API_BASE_URL}${path}`);
    await this.requestAbsolute<unknown>(url, init);
  }

  private async buildHeaders(init: RequestInit, url: URL): Promise<Headers> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/vnd.github+json");
    headers.set("x-github-api-version", GITHUB_API_VERSION);
    headers.set("user-agent", "MikaCLI");

    if (init.body) {
      headers.set("content-type", "application/json; charset=utf-8");
    }

    if (this.auth.kind === "apiKey") {
      headers.set("authorization", `Bearer ${this.auth.token}`);
      return headers;
    }

    if (isMutatingMethod(init.method)) {
      headers.set("origin", new URL(GITHUB_HOME_URL).origin);
      headers.set("referer", GITHUB_HOME_URL);
      headers.set("x-requested-with", "XMLHttpRequest");

      const csrfToken = await this.getCsrfToken();
      if (csrfToken) {
        headers.set("x-csrf-token", csrfToken);
      }
    }

    return headers;
  }

  private async getCsrfToken(): Promise<string | undefined> {
    if (this.auth.kind !== "cookies") {
      return undefined;
    }

    if (this.csrfTokenLoaded) {
      return this.csrfToken;
    }

    this.csrfTokenLoaded = true;
    try {
      const response = await this.fetchImpl(GITHUB_SETTINGS_PROFILE_URL, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (response.url.includes("/login")) {
        return undefined;
      }

      const html = await response.text();
      this.csrfToken = extractCsrfToken(html);
      return this.csrfToken;
    } catch {
      return undefined;
    }
  }

  private mapErrorCode(status: number): string {
    if (status === 401) {
      return this.auth.kind === "cookies" ? "GITHUB_SESSION_INVALID" : "GITHUB_TOKEN_INVALID";
    }

    if (status === 403) {
      return "GITHUB_FORBIDDEN";
    }

    if (status === 404) {
      return "GITHUB_NOT_FOUND";
    }

    if (status === 422) {
      return "GITHUB_VALIDATION_FAILED";
    }

    return "GITHUB_REQUEST_FAILED";
  }

  private buildErrorMessage(status: number, parsed: unknown): string {
    const message =
      parsed && typeof parsed === "object" && typeof (parsed as { message?: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : undefined;

    if (status === 401) {
      return this.auth.kind === "cookies"
        ? "GitHub rejected the saved web session."
        : "GitHub rejected the supplied token.";
    }

    if (message) {
      return `GitHub API request failed: ${message}`;
    }

    return `GitHub API request failed with HTTP ${status}.`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isMutatingMethod(method?: string): boolean {
  const normalized = (method ?? "GET").toUpperCase();
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
}

function extractCsrfToken(html: string): string | undefined {
  const metaPatterns = [
    /<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/iu,
    /<meta[^>]+content="([^"]+)"[^>]+name="csrf-token"/iu,
    /<input[^>]+name="authenticity_token"[^>]+value="([^"]+)"/iu,
    /<input[^>]+value="([^"]+)"[^>]+name="authenticity_token"/iu,
  ];

  for (const pattern of metaPatterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

type ParsedGitHubViewer = {
  id?: number;
  login?: string;
  name?: string | null;
  html_url?: string;
  avatar_url?: string;
  email?: string | null;
};

function extractViewerFromSettingsHtml(html: string): ParsedGitHubViewer {
  const parsed: ParsedGitHubViewer = {};

  const embeddedDataMatch = /<script[^>]+data-target="react-partial\.embeddedData"[^>]*>([\s\S]*?)<\/script>/iu.exec(html);
  if (embeddedDataMatch?.[1]) {
    try {
      const payload = JSON.parse(embeddedDataMatch[1]) as {
        props?: {
          userMenu?: {
            owner?: {
              login?: string;
              name?: string | null;
              avatarUrl?: string;
            };
          };
        };
      };
      const owner = payload.props?.userMenu?.owner;
      if (owner?.login) {
        parsed.login = owner.login;
        parsed.name = owner.name ?? null;
        parsed.avatar_url = owner.avatarUrl;
        parsed.html_url = `${GITHUB_HOME_URL}${owner.login}`;
      }
    } catch {
      // Ignore embedded JSON parse failures and continue with regex fallbacks.
    }
  }

  const actorIdMatch = /<meta[^>]+name="octolytics-actor-id"[^>]+content="([0-9]+)"/iu.exec(html);
  if (actorIdMatch?.[1]) {
    parsed.id = Number(actorIdMatch[1]);
  }

  const actorLoginMatch = /<meta[^>]+name="octolytics-actor-login"[^>]+content="([^"]+)"/iu.exec(html);
  if (actorLoginMatch?.[1]) {
    parsed.login ??= actorLoginMatch[1];
    parsed.html_url ??= `${GITHUB_HOME_URL}${actorLoginMatch[1]}`;
  }

  const nameMatch = /<input[^>]+id="user_profile_name"[^>]+value="([^"]*)"/iu.exec(html);
  if (nameMatch?.[1] !== undefined) {
    parsed.name = decodeHtmlEntities(nameMatch[1]) || parsed.name || null;
  }

  const avatarMatch = /<img[^>]+data-testid="github-avatar"[^>]+src="([^"]+)"/iu.exec(html)
    ?? /<img[^>]+class="[^"]*avatar-user[^"]*"[^>]+src="([^"]+)"/iu.exec(html);
  if (avatarMatch?.[1]) {
    parsed.avatar_url = decodeHtmlEntities(avatarMatch[1]);
  }

  return parsed;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export { GitHubApiClient as GitHubWebSessionClient };
