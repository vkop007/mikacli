import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";
import { CookieManager, createSessionFile, serializeCookieJar } from "../../../utils/cookie-manager.js";
import type { CookieJar } from "tough-cookie";
import {
  encodeGitLabProjectTarget,
  getGitLabRuntimeBaseUrl,
  getGitLabRuntimeOrigin,
  normalizeGitLabProjectTarget,
  normalizeGitLabState,
} from "./helpers.js";
import { GitLabApiClient, type GitLabIssue, type GitLabMergeRequest, type GitLabProject, type GitLabUser } from "./client.js";

type GitLabCookieLoadedSession = Awaited<ReturnType<CookieManager["loadSession"]>>;

type GitLabLoadedConnection = {
  session: GitLabCookieLoadedSession["session"];
  path: string;
  jar: Awaited<ReturnType<CookieManager["createJar"]>>;
  baseUrl: string;
};

export class GitLabAdapter {
  readonly platform: Platform = "gitlab";
  readonly displayName = "GitLab";

  private readonly cookieManager = new CookieManager();

  async login(input: { account?: string; cookieFile?: string; cookieString?: string; cookieJson?: string }): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const baseUrl = this.resolveBaseUrl();
    await this.ensureSessionCookie(imported.jar, baseUrl);

    const client = this.createClient({ jar: imported.jar, baseUrl });
    const me = await client.getMe();
    const user = this.toSessionUser(me);
    const account = input.account?.trim() || me.username.trim() || String(me.id);
    const status = this.activeStatus("GitLab web session validated.");
    const sessionPath = await this.cookieManager.saveSession(
      createSessionFile({
        platform: this.platform,
        account,
        source: imported.source,
        user,
        status,
        metadata: {
          baseUrl,
          gitlabUserId: String(me.id),
          gitlabUsername: me.username,
          gitlabProfileUrl: me.web_url,
        },
        cookieJar: serializeCookieJar(imported.jar),
      }),
    );

    return this.buildResult({
      account,
      action: "login",
      message: `Saved ${this.displayName} session for ${me.username}.`,
      sessionPath,
      user,
      data: {
        user: {
          ...user,
          url: me.web_url,
          state: me.state,
          email: me.public_email,
          baseUrl,
        },
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account);
    const client = this.createClientForLoaded(loaded);
    const me = await client.getMe();
    const user = this.toSessionUser(me);
    const status = this.activeStatus("GitLab web session validated.");
    await this.touchConnection(loaded, user, status, me);

    return {
      platform: this.platform,
      account: loaded.session.account,
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
    const client = this.createClientForLoaded(loaded);
    const me = await client.getMe();
    const user = this.toSessionUser(me);
    await this.touchConnection(loaded, user, this.activeStatus("GitLab web session validated."), me);

    return this.buildResult({
      account: loaded.session.account,
      action: "me",
      message: "Loaded GitLab account identity.",
      sessionPath: loaded.path,
      user,
      data: {
        user: {
          ...user,
          url: me.web_url,
          state: me.state,
          email: me.public_email,
          baseUrl: loaded.baseUrl,
        },
      },
    });
  }

  async projects(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClientForLoaded(loaded);
    const projects = await client.listProjects({ query: input.query, limit: input.limit });
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab projects loaded."));

    return this.buildResult({
      account: loaded.session.account,
      action: "projects",
      message: `Loaded ${projects.length} GitLab project${projects.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.session.user,
      data: {
        query: input.query,
        projects: projects.map((project) => this.summarizeProject(project)),
      },
    });
  }

  async project(target: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClientForLoaded(loaded);
    const project = await client.getProject(encodeGitLabProjectTarget(target));
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab project loaded."));

    return this.buildResult({
      account: loaded.session.account,
      action: "project",
      message: `Loaded GitLab project ${project.path_with_namespace}.`,
      sessionPath: loaded.path,
      user: loaded.session.user,
      id: String(project.id),
      url: project.web_url,
      data: {
        project: this.summarizeProject(project),
      },
    });
  }

  async searchProjects(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClientForLoaded(loaded);
    const projects = await client.searchProjects({ query: input.query, limit: input.limit });
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab project search completed."));

    return this.buildResult({
      account: loaded.session.account,
      action: "search-projects",
      message: `Found ${projects.length} GitLab project${projects.length === 1 ? "" : "s"} for "${input.query}".`,
      sessionPath: loaded.path,
      user: loaded.session.user,
      data: {
        query: input.query,
        projects: projects.map((project) => this.summarizeProject(project)),
      },
    });
  }

  async issues(input: { project: string; state?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClientForLoaded(loaded);
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const issues = await client.listIssues({
      project: projectPath,
      state: normalizeGitLabState(input.state),
      limit: input.limit,
    });
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab issues loaded."));

    return this.buildResult({
      account: loaded.session.account,
      action: "issues",
      message: `Loaded ${issues.length} issue${issues.length === 1 ? "" : "s"} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.session.user,
      data: {
        project: projectPath,
        issues: issues.map((issue) => this.summarizeIssue(issue)),
      },
    });
  }

  async issue(input: { project: string; iid: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClientForLoaded(loaded);
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const issue = await client.getIssue({
      project: projectPath,
      iid: input.iid,
    });
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab issue loaded."));

    return this.buildResult({
      account: loaded.session.account,
      action: "issue",
      message: `Loaded issue !${issue.iid} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.session.user,
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
    const client = this.createClientForLoaded(loaded);
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const title = input.title.trim();
    if (!title) {
      throw new AutoCliError("GITLAB_ISSUE_TITLE_INVALID", "GitLab issue title cannot be empty.");
    }

    const issue = await client.createIssue({
      project: projectPath,
      title,
      description: input.body?.trim(),
    });
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab issue created."));

    return this.buildResult({
      account: loaded.session.account,
      action: "create-issue",
      message: `Created GitLab issue !${issue.iid} in ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.session.user,
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
    const client = this.createClientForLoaded(loaded);
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const mergeRequests = await client.listMergeRequests({
      project: projectPath,
      state: normalizeGitLabState(input.state),
      limit: input.limit,
    });
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab merge requests loaded."));

    return this.buildResult({
      account: loaded.session.account,
      action: "merge-requests",
      message: `Loaded ${mergeRequests.length} merge request${mergeRequests.length === 1 ? "" : "s"} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.session.user,
      data: {
        project: projectPath,
        mergeRequests: mergeRequests.map((mergeRequest) => this.summarizeMergeRequest(mergeRequest)),
      },
    });
  }

  async mergeRequest(input: { project: string; iid: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClientForLoaded(loaded);
    const projectPath = normalizeGitLabProjectTarget(input.project);
    const mergeRequest = await client.getMergeRequest({
      project: projectPath,
      iid: input.iid,
    });
    await this.touchConnection(loaded, loaded.session.user, this.activeStatus("GitLab merge request loaded."));

    return this.buildResult({
      account: loaded.session.account,
      action: "merge-request",
      message: `Loaded merge request !${mergeRequest.iid} from ${projectPath}.`,
      sessionPath: loaded.path,
      user: loaded.session.user,
      id: String(mergeRequest.iid),
      url: mergeRequest.web_url,
      data: {
        project: projectPath,
        mergeRequest: this.summarizeMergeRequest(mergeRequest),
      },
    });
  }

  private createClient(input: { jar: CookieJar; baseUrl: string }): GitLabApiClient {
    return new GitLabApiClient({
      jar: input.jar,
      baseUrl: input.baseUrl,
    });
  }

  private createClientForLoaded(loaded: GitLabLoadedConnection): GitLabApiClient {
    return this.createClient({ jar: loaded.jar, baseUrl: loaded.baseUrl });
  }

  private async loadConnection(account?: string): Promise<GitLabLoadedConnection> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    return {
      session,
      path,
      jar: await this.cookieManager.createJar(session),
      baseUrl: this.resolveBaseUrl(session.metadata),
    };
  }

  private async touchConnection(loaded: GitLabLoadedConnection, user: SessionUser | undefined, status: SessionStatus, me?: GitLabUser): Promise<void> {
    await this.cookieManager.saveSession(
      createSessionFile({
        platform: this.platform,
        account: loaded.session.account,
        source: loaded.session.source,
        user,
        status,
        metadata: {
          ...(loaded.session.metadata ?? {}),
          baseUrl: loaded.baseUrl,
          ...(me
            ? {
                gitlabUserId: String(me.id),
                gitlabUsername: me.username,
                gitlabProfileUrl: me.web_url,
              }
            : {}),
        },
        cookieJar: serializeCookieJar(loaded.jar),
        existingSession: loaded.session,
      }),
    );
  }

  private resolveBaseUrl(metadata?: Record<string, unknown>): string {
    return getGitLabRuntimeBaseUrl(metadata);
  }

  private async ensureSessionCookie(jar: Awaited<ReturnType<CookieManager["createJar"]>>, baseUrl: string): Promise<void> {
    const cookies = await jar.getCookies(getGitLabRuntimeOrigin({ baseUrl }));
    if (cookies.some((cookie) => cookie.key.endsWith("gitlab_session"))) {
      return;
    }

    throw new AutoCliError("GITLAB_SESSION_COOKIE_MISSING", "Imported cookies did not include GitLab's _gitlab_session cookie.", {
      details: {
        baseUrl,
        cookieNames: cookies.map((cookie) => cookie.key),
      },
    });
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
