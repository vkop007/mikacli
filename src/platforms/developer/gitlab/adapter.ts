import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";
import {
  buildGitLabProjectUrl,
  encodeGitLabProjectTarget,
  getGitLabProjectDisplayName,
  getGitLabRuntimeBaseUrl,
  normalizeGitLabProjectTarget,
  normalizeGitLabState,
  normalizeGitLabToken,
} from "./helpers.js";
import {
  GitLabApiClient,
  type GitLabIssue,
  type GitLabMergeRequest,
  type GitLabProject,
  type GitLabUser,
} from "./client.js";

type GitLabLoadedConnection = Awaited<ReturnType<ConnectionStore["loadApiKeyConnection"]>>;

export class GitLabAdapter {
  readonly platform: Platform = "gitlab";
  readonly displayName = "GitLab";

  private readonly connectionStore = new ConnectionStore();

  async loginWithToken(input: { token: string }): Promise<AdapterActionResult> {
    const token = normalizeGitLabToken(input.token);
    const client = this.createClient(token);
    const me = await client.getMe();
    const user = this.toSessionUser(me);
    const account = me.username.trim();
    const status = this.activeStatus("GitLab token validated.");
    const sessionPath = await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account,
      provider: "gitlab",
      token,
      user,
      status,
      metadata: {
        baseUrl: this.resolveBaseUrl(),
      },
    });

    return this.buildResult({
      account,
      action: "login",
      message: `Saved ${this.displayName} token for ${me.username}.`,
      sessionPath,
      user,
      data: {
        user: {
          ...user,
          state: me.state,
          email: me.public_email,
          baseUrl: this.resolveBaseUrl(),
        },
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account);
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const me = await client.getMe();
    const user = this.toSessionUser(me);
    const status = this.activeStatus("GitLab token validated.");
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "gitlab",
      token: loaded.auth.token,
      user,
      status,
      metadata: {
        ...(loaded.connection.metadata ?? {}),
        baseUrl: this.resolveBaseUrl(loaded.connection.metadata),
      },
    });

    return {
      platform: this.platform,
      account: loaded.connection.account,
      sessionPath: loaded.path,
      connected: true,
      status: "active",
      message: status.message,
      user,
      lastValidatedAt: status.lastValidatedAt,
    };
  }

  async me(): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const me = await client.getMe();
    const user = this.toSessionUser(me);
    await this.touchConnection(loaded, user, "GitLab token validated.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "me",
      message: "Loaded GitLab account identity.",
      sessionPath: loaded.path,
      user,
      data: {
        user: {
          ...user,
          state: me.state,
          email: me.public_email,
          baseUrl: this.resolveBaseUrl(loaded.connection.metadata),
        },
      },
    });
  }

  async projects(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const projects = await client.listProjects({ query: input.query, limit: input.limit });
    await this.touchConnection(loaded, loaded.connection.user, "GitLab projects loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "projects",
      message: `Loaded ${projects.length} GitLab project${projects.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        query: input.query,
        projects: projects.map((project) => this.summarizeProject(project)),
      },
    });
  }

  async project(target: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const project = await client.getProject(encodeGitLabProjectTarget(target));
    await this.touchConnection(loaded, loaded.connection.user, "GitLab project loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "project",
      message: `Loaded GitLab project ${project.path_with_namespace}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(project.id),
      url: project.web_url,
      data: {
        project: this.summarizeProject(project),
      },
    });
  }

  async searchProjects(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const projects = await client.searchProjects({ query: input.query, limit: input.limit });
    await this.touchConnection(loaded, loaded.connection.user, "GitLab project search completed.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "search-projects",
      message: `Found ${projects.length} GitLab project${projects.length === 1 ? "" : "s"} for "${input.query}".`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        query: input.query,
        projects: projects.map((project) => this.summarizeProject(project)),
      },
    });
  }

  async issues(input: { project: string; state?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const issues = await client.listIssues({
      project: projectPath,
      state: normalizeGitLabState(input.state),
      limit: input.limit,
    });
    await this.touchConnection(loaded, loaded.connection.user, "GitLab issues loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "issues",
      message: `Loaded ${issues.length} issue${issues.length === 1 ? "" : "s"} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        project: projectPath,
        issues: issues.map((issue) => this.summarizeIssue(issue)),
      },
    });
  }

  async issue(input: { project: string; iid: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const issue = await client.getIssue({
      project: projectPath,
      iid: input.iid,
    });
    await this.touchConnection(loaded, loaded.connection.user, "GitLab issue loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "issue",
      message: `Loaded issue !${issue.iid} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(issue.iid),
      url: issue.web_url,
      data: {
        project: projectPath,
        issue: this.summarizeIssue(issue),
      },
    });
  }

  async createIssue(input: { project: string; title: string; body?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const issue = await client.createIssue({
      project: projectPath,
      title: input.title.trim(),
      description: input.body?.trim(),
    });
    await this.touchConnection(loaded, loaded.connection.user, "GitLab issue created.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "create-issue",
      message: `Created GitLab issue !${issue.iid} in ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(issue.iid),
      url: issue.web_url,
      data: {
        project: projectPath,
        issue: this.summarizeIssue(issue),
      },
    });
  }

  async mergeRequests(input: { project: string; state?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const mergeRequests = await client.listMergeRequests({
      project: projectPath,
      state: normalizeGitLabState(input.state),
      limit: input.limit,
    });
    await this.touchConnection(loaded, loaded.connection.user, "GitLab merge requests loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "merge-requests",
      message: `Loaded ${mergeRequests.length} merge request${mergeRequests.length === 1 ? "" : "s"} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        project: projectPath,
        mergeRequests: mergeRequests.map((mergeRequest) => this.summarizeMergeRequest(mergeRequest)),
      },
    });
  }

  async mergeRequest(input: { project: string; iid: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token, this.resolveBaseUrl(loaded.connection.metadata));
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const mergeRequest = await client.getMergeRequest({
      project: projectPath,
      iid: input.iid,
    });
    await this.touchConnection(loaded, loaded.connection.user, "GitLab merge request loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "merge-request",
      message: `Loaded merge request !${mergeRequest.iid} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(mergeRequest.iid),
      url: mergeRequest.web_url,
      data: {
        project: projectPath,
        mergeRequest: this.summarizeMergeRequest(mergeRequest),
      },
    });
  }

  private createClient(token: string, baseUrl?: string): GitLabApiClient {
    return new GitLabApiClient({ token, baseUrl });
  }

  private async loadConnection(account?: string): Promise<GitLabLoadedConnection> {
    const loaded = await this.connectionStore.loadApiKeyConnection(this.platform, account);
    if (!loaded.auth.token) {
      throw new AutoCliError("GITLAB_TOKEN_MISSING", "The saved GitLab connection is missing its token.", {
        details: {
          account: loaded.connection.account,
          connectionPath: loaded.path,
        },
      });
    }
    return loaded;
  }

  private async touchConnection(loaded: GitLabLoadedConnection, user: SessionUser | undefined, message: string): Promise<void> {
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "gitlab",
      token: loaded.auth.token,
      user,
      status: this.activeStatus(message),
      metadata: {
        ...(loaded.connection.metadata ?? {}),
        baseUrl: this.resolveBaseUrl(loaded.connection.metadata),
      },
    });
  }

  private resolveBaseUrl(metadata?: Record<string, unknown>): string {
    return getGitLabRuntimeBaseUrl(metadata);
  }

  private summarizeProject(project: GitLabProject): Record<string, unknown> {
    return {
      id: project.id,
      name: project.name,
      path: project.path,
      pathWithNamespace: project.path_with_namespace,
      description: project.description,
      url: project.web_url,
      visibility: project.visibility,
      stars: project.star_count,
      forks: project.forks_count,
      openIssues: project.open_issues_count,
      defaultBranch: project.default_branch,
      archived: project.archived,
      createdAt: project.created_at,
      updatedAt: project.last_activity_at,
    };
  }

  private summarizeIssue(issue: GitLabIssue): Record<string, unknown> {
    return {
      id: issue.id,
      iid: issue.iid,
      title: issue.title,
      description: issue.description,
      state: issue.state,
      url: issue.web_url,
      author: issue.author?.username ?? issue.author?.name,
      labels: issue.labels,
      commentsCount: issue.comments_count,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at,
    };
  }

  private summarizeMergeRequest(mergeRequest: GitLabMergeRequest): Record<string, unknown> {
    return {
      id: mergeRequest.id,
      iid: mergeRequest.iid,
      title: mergeRequest.title,
      description: mergeRequest.description,
      state: mergeRequest.state,
      url: mergeRequest.web_url,
      author: mergeRequest.author?.username ?? mergeRequest.author?.name,
      labels: mergeRequest.labels,
      commentsCount: mergeRequest.comments_count,
      sourceBranch: mergeRequest.source_branch,
      targetBranch: mergeRequest.target_branch,
      draft: mergeRequest.draft ?? mergeRequest.work_in_progress,
      createdAt: mergeRequest.created_at,
      updatedAt: mergeRequest.updated_at,
      mergedAt: mergeRequest.merged_at,
      mergeStatus: mergeRequest.merge_status,
      hasConflicts: mergeRequest.has_conflicts,
    };
  }

  private toSessionUser(user: GitLabUser): SessionUser {
    return {
      id: String(user.id),
      username: user.username,
      displayName: user.name || user.username,
      profileUrl: user.web_url,
    };
  }

  private activeStatus(message: string): SessionStatus {
    return {
      state: "active",
      message,
      lastValidatedAt: new Date().toISOString(),
    };
  }

  private buildResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    id?: string;
    url?: string;
    data?: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      ...(input.id ? { id: input.id } : {}),
      ...(input.url ? { url: input.url } : {}),
      ...(input.data ? { data: input.data } : {}),
    };
  }
}

export const gitlabAdapter = new GitLabAdapter();
