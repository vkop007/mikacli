import { AutoCliError } from "../../../errors.js";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

type FetchLike = typeof fetch;

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
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(input: { token: string; fetchImpl?: FetchLike }) {
    this.token = input.token;
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  async getViewer(): Promise<GitHubViewer> {
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

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(`${GITHUB_API_BASE_URL}${path}`);
    return this.requestAbsolute<T>(url, init);
  }

  private async requestAbsolute<T>(url: URL, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": GITHUB_API_VERSION,
        "user-agent": "AutoCLI",
        ...(init.body ? { "content-type": "application/json; charset=utf-8" } : {}),
        ...(init.headers ?? {}),
      },
    });

    const raw = await response.text();
    const parsed = raw.length > 0 ? tryParseJson(raw) : undefined;

    if (!response.ok) {
      throw new AutoCliError(this.mapErrorCode(response.status), this.buildErrorMessage(response.status, parsed), {
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
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": GITHUB_API_VERSION,
        "user-agent": "AutoCLI",
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 204) {
      return;
    }

    const raw = await response.text();
    const parsed = raw.length > 0 ? tryParseJson(raw) : undefined;
    if (!response.ok) {
      throw new AutoCliError(this.mapErrorCode(response.status), this.buildErrorMessage(response.status, parsed), {
        details: {
          status: response.status,
          statusText: response.statusText,
          url: url.toString(),
          body: parsed ?? raw,
        },
      });
    }
  }

  private mapErrorCode(status: number): string {
    if (status === 401) {
      return "GITHUB_TOKEN_INVALID";
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
      return "GitHub rejected the supplied token.";
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
