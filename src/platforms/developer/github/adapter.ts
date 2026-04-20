import { sanitizeAccountName } from "../../../config.js";
import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { MikaCliError } from "../../../errors.js";
import { CookieManager, createSessionFile, serializeCookieJar } from "../../../utils/cookie-manager.js";
import type { AdapterActionResult, AdapterStatusResult, LoginInput, Platform, PlatformSession, SessionStatus, SessionUser } from "../../../types.js";
import { buildGitHubIssueUrl, buildGitHubRepoUrl, normalizeGitHubToken, parseGitHubRepoTarget } from "./helpers.js";
import {
  GitHubApiClient,
  type GitHubBranch,
  type GitHubIssue,
  type GitHubIssueComment,
  type GitHubPullRequest,
  type GitHubReadme,
  type GitHubRelease,
  type GitHubRepo,
  type GitHubUser,
  type GitHubViewer,
} from "./client.js";

import type { CookieJar } from "tough-cookie";

type GitHubAuthMode = "cookies" | "apiKey";

type GitHubAdapterOptions = {
  platform?: Platform;
  displayName?: string;
  provider?: string;
  authMode?: GitHubAuthMode;
};

type GitHubLoadedConnection = {
  kind: GitHubAuthMode;
  account: string;
  path: string;
  client: GitHubApiClient;
  connection: {
    account: string;
    metadata?: Record<string, unknown>;
    user?: SessionUser;
  };
  session?: PlatformSession;
  auth?: {
    token: string;
    provider?: string;
  };
  jar?: CookieJar;
  viewer?: GitHubViewer;
  user?: SessionUser;
};

export class GitHubAdapter {
  readonly platform: Platform;
  readonly displayName: string;
  readonly authMode: GitHubAuthMode;

  private readonly cookieManager = new CookieManager();
  private readonly connectionStore = new ConnectionStore();
  private readonly provider: string;

  constructor(options: GitHubAdapterOptions = {}) {
    this.platform = options.platform ?? "github";
    this.displayName = options.displayName ?? "GitHub";
    this.provider = options.provider ?? this.platform;
    this.authMode = options.authMode ?? (this.platform === "githubbot" ? "apiKey" : "cookies");
  }

  async login(input: LoginInput): Promise<AdapterActionResult> {
    if (this.authMode === "apiKey") {
      return this.loginWithToken({
        token: input.token ?? "",
        account: input.account,
      });
    }

    return this.loginWithCookies(input);
  }

  async loginWithToken(input: { token: string; account?: string }): Promise<AdapterActionResult> {
    const token = normalizeGitHubToken(input.token);
    const client = new GitHubApiClient({ token });
    const viewer = await client.getViewer();
    const account = sanitizeAccountName(input.account?.trim() || viewer.login);
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus(this.validationMessage());
    const sessionPath = await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account,
      provider: this.provider,
      token,
      user,
      status,
      metadata: this.buildMetadata(user, {
        authMode: "apiKey",
        login: viewer.login,
        profileUrl: viewer.html_url,
      }),
    });

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message: `Saved ${this.displayName} token for ${viewer.login}.`,
      sessionPath,
      user,
      data: {
        user,
      },
    };
  }

  async loginWithCookies(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, {
      account: input.account,
      cookieFile: input.cookieFile,
      cookieString: input.cookieString,
      cookieJson: input.cookieJson,
      browser: input.browser,
      browserTimeoutSeconds: input.browserTimeoutSeconds,
      browserUrl: input.browserUrl,
    });
    const client = new GitHubApiClient({ jar: imported.jar });
    const viewer = await client.getViewer();
    const account = sanitizeAccountName(input.account?.trim() || viewer.login);
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus(this.validationMessage());
    const session = createSessionFile({
      platform: this.platform,
      account,
      source: imported.source,
      user,
      status,
      metadata: this.buildMetadata(user, {
        authMode: "cookies",
        login: viewer.login,
        profileUrl: viewer.html_url,
      }),
      cookieJar: serializeCookieJar(imported.jar),
    });
    const sessionPath = await this.cookieManager.saveSession(session);

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message: `Saved ${this.displayName} web session for ${viewer.login}.`,
      sessionPath,
      user,
      data: {
        user,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account, { validate: false });
    try {
      const validated = await this.validateConnection(loaded);
      const status = this.activeStatus(this.validationMessage());
      await this.persistConnection(validated, status);

      return {
        platform: this.platform,
        account: validated.connection.account,
        sessionPath: validated.path,
        connected: true,
        status: status.state,
        message: status.message,
        user: validated.connection.user,
        lastValidatedAt: status.lastValidatedAt,
      };
    } catch (error) {
      const expired = this.expiredStatus(error);
      await this.persistConnection(loaded, expired);

      return {
        platform: this.platform,
        account: loaded.connection.account,
        sessionPath: loaded.path,
        connected: false,
        status: expired.state,
        message: expired.message,
        user: loaded.connection.user,
        lastValidatedAt: expired.lastValidatedAt,
      };
    }
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(account);
    const viewer = loaded.viewer ?? (await loaded.client.getViewer());
    const user = loaded.connection.user ?? this.toSessionUser(viewer);
    await this.touchConnection(loaded, `${this.displayName} session validated.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "me",
      message: `Loaded ${this.displayName} account identity.`,
      sessionPath: loaded.path,
      user,
      data: {
        user: {
          ...user,
          publicRepos: viewer.public_repos,
          followers: viewer.followers,
          following: viewer.following,
          email: viewer.email,
        },
      },
    });
  }

  async user(login: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const user = await loaded.client.getUser(login.trim());
    await this.touchConnection(loaded, `${this.displayName} user loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "user",
      message: `Loaded ${this.displayName} user ${user.login}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(user.id),
      url: user.html_url,
      data: {
        user: this.summarizeUser(user),
      },
    });
  }

  async repos(input: { account?: string; owner?: string; limit?: number; sort?: string; type?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const fallbackOwner = !input.owner && loaded.kind === "cookies" ? loaded.connection.user?.username : undefined;
    const owner = input.owner ?? fallbackOwner;
    const repos = owner
      ? await loaded.client.listUserRepos({ owner, limit: input.limit, sort: input.sort })
      : await loaded.client.listViewerRepos({ limit: input.limit, sort: input.sort, type: input.type });
    await this.touchConnection(loaded, `${this.displayName} repositories loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "repos",
      message: `Loaded ${repos.length} ${this.displayName} repositor${repos.length === 1 ? "y" : "ies"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        owner,
        repos: repos.map((repo) => this.summarizeRepo(repo)),
      },
    });
  }

  async repo(input: { account?: string; target: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const { fullName } = parseGitHubRepoTarget(input.target);
    const repo = await loaded.client.getRepo(fullName);
    await this.touchConnection(loaded, `${this.displayName} repository loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "repo",
      message: `Loaded ${this.displayName} repository ${repo.full_name}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(repo.id),
      url: repo.html_url,
      data: {
        repo: this.summarizeRepo(repo),
      },
    });
  }

  async starred(input: { owner?: string; limit?: number; sort?: string; direction?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const fallbackOwner = !input.owner && loaded.kind === "cookies" ? loaded.connection.user?.username : undefined;
    const owner = input.owner ?? fallbackOwner;
    const repos = await loaded.client.listStarredRepos({
      owner,
      limit: input.limit,
      sort: input.sort,
      direction: input.direction,
    });
    await this.touchConnection(loaded, `${this.displayName} starred repositories loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "starred",
      message: `Loaded ${repos.length} starred ${this.displayName} repositor${repos.length === 1 ? "y" : "ies"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        owner,
        repos: repos.map((repo) => this.summarizeRepo(repo)),
      },
    });
  }

  async branches(input: { repo: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const branches = await loaded.client.listBranches({ fullName, limit: input.limit });
    await this.touchConnection(loaded, `${this.displayName} branches loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "branches",
      message: `Loaded ${branches.length} branch${branches.length === 1 ? "" : "es"} from ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        repo: fullName,
        branches: branches.map((branch) => this.summarizeBranch(branch)),
      },
    });
  }

  async branch(input: { repo: string; branch: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const branch = await loaded.client.getBranch({ fullName, branch: input.branch });
    await this.touchConnection(loaded, `${this.displayName} branch loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "branch",
      message: `Loaded branch ${branch.name} from ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        repo: fullName,
        branch: this.summarizeBranch(branch),
      },
    });
  }

  async searchRepos(input: { account?: string; query: string; limit?: number; sort?: string; order?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const search = await loaded.client.searchRepos({
      query: input.query,
      limit: input.limit,
      sort: input.sort,
      order: input.order,
    });
    await this.touchConnection(loaded, `${this.displayName} repository search completed.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "search-repos",
      message: `Found ${search.items.length} ${this.displayName} repositories for "${input.query}".`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        query: input.query,
        totalCount: search.total_count,
        repos: search.items.map((repo) => this.summarizeRepo(repo)),
      },
    });
  }

  async issues(input: { account?: string; repo: string; state?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const issues = (await loaded.client.listIssues({ fullName, state: input.state, limit: input.limit })).filter((issue) => !issue.pull_request);
    await this.touchConnection(loaded, `${this.displayName} issues loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "issues",
      message: `Loaded ${issues.length} issue${issues.length === 1 ? "" : "s"} from ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        repo: fullName,
        issues: issues.map((issue) => this.summarizeIssue(fullName, issue)),
      },
    });
  }

  async pulls(input: { repo: string; state?: string; limit?: number; sort?: string; direction?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const pulls = await loaded.client.listPulls({
      fullName,
      state: input.state,
      limit: input.limit,
      sort: input.sort,
      direction: input.direction,
    });
    await this.touchConnection(loaded, `${this.displayName} pull requests loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "pulls",
      message: `Loaded ${pulls.length} pull request${pulls.length === 1 ? "" : "s"} from ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        repo: fullName,
        pulls: pulls.map((pull) => this.summarizePull(pull)),
      },
    });
  }

  async pull(input: { repo: string; number: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const pull = await loaded.client.getPull({ fullName, pullNumber: input.number });
    await this.touchConnection(loaded, `${this.displayName} pull request loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "pull",
      message: `Loaded pull request #${pull.number} from ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(pull.number),
      url: pull.html_url,
      data: {
        repo: fullName,
        pull: this.summarizePull(pull),
      },
    });
  }

  async issue(input: { account?: string; repo: string; number: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const issue = await loaded.client.getIssue({ fullName, issueNumber: input.number });
    await this.touchConnection(loaded, `${this.displayName} issue loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "issue",
      message: `Loaded issue #${issue.number} from ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(issue.number),
      url: issue.html_url,
      data: {
        repo: fullName,
        issue: this.summarizeIssue(fullName, issue),
      },
    });
  }

  async comment(input: { repo: string; number: number; body: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const comment = await loaded.client.createIssueComment({
      fullName,
      issueNumber: input.number,
      body: input.body.trim(),
    });
    await this.touchConnection(loaded, `${this.displayName} issue comment created.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "comment",
      message: `Added a comment to issue #${input.number} in ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(comment.id),
      url: comment.html_url,
      data: {
        repo: fullName,
        comment: this.summarizeComment(comment),
      },
    });
  }

  async createIssue(input: { account?: string; repo: string; title: string; body?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const issue = await loaded.client.createIssue({ fullName, title: input.title.trim(), body: input.body?.trim() });
    await this.touchConnection(loaded, `${this.displayName} issue created.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "create-issue",
      message: `Created ${this.displayName} issue #${issue.number} in ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(issue.number),
      url: issue.html_url,
      data: {
        repo: fullName,
        issue: this.summarizeIssue(fullName, issue),
      },
    });
  }

  async createRepo(input: { account?: string; name: string; description?: string; private?: boolean; homepage?: string; autoInit?: boolean }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const repo = await loaded.client.createRepo({
      name: input.name.trim(),
      description: input.description?.trim(),
      private: input.private,
      homepage: input.homepage?.trim(),
      autoInit: input.autoInit,
    });
    await this.touchConnection(loaded, `${this.displayName} repository created.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "create-repo",
      message: `Created ${this.displayName} repository ${repo.full_name}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(repo.id),
      url: repo.html_url,
      data: {
        repo: this.summarizeRepo(repo),
      },
    });
  }

  async fork(input: { repo: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const repo = await loaded.client.forkRepo(fullName);
    await this.touchConnection(loaded, `${this.displayName} repository fork created.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "fork",
      message: `Created a fork of ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: String(repo.id),
      url: repo.html_url,
      data: {
        repo: this.summarizeRepo(repo),
      },
    });
  }

  async releases(input: { repo: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const releases = await loaded.client.listReleases({ fullName, limit: input.limit });
    await this.touchConnection(loaded, `${this.displayName} releases loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "releases",
      message: `Loaded ${releases.length} release${releases.length === 1 ? "" : "s"} from ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        repo: fullName,
        releases: releases.map((release) => this.summarizeRelease(release)),
      },
    });
  }

  async readme(input: { repo: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const readme = await loaded.client.getReadme(fullName);
    const content = decodeGitHubReadme(readme);
    await this.touchConnection(loaded, `${this.displayName} README loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "readme",
      message: `Loaded README for ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      url: readme.html_url,
      data: {
        repo: fullName,
        readme: this.summarizeReadme(readme, content),
      },
    });
  }

  async star(input: { account?: string; repo: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    await loaded.client.starRepo(fullName);
    await this.touchConnection(loaded, `${this.displayName} repository starred.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "star",
      message: `Starred ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      url: buildGitHubRepoUrl(fullName),
      data: {
        repo: fullName,
      },
    });
  }

  async unstar(input: { account?: string; repo: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    await loaded.client.unstarRepo(fullName);
    await this.touchConnection(loaded, `${this.displayName} repository unstarred.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "unstar",
      message: `Unstarred ${fullName}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      url: buildGitHubRepoUrl(fullName),
      data: {
        repo: fullName,
      },
    });
  }

  private async loadConnection(account?: string, options: { validate?: boolean } = {}): Promise<GitHubLoadedConnection> {
    const loaded =
      this.authMode === "cookies"
        ? await this.loadCookieConnection(account)
        : await this.loadApiKeyConnection(account);

    if (options.validate === false) {
      return loaded;
    }

    try {
      return await this.validateConnection(loaded);
    } catch (error) {
      if (error instanceof MikaCliError) {
        await this.markConnectionExpired(loaded, error);
      }
      throw error;
    }
  }

  private async loadCookieConnection(account?: string): Promise<GitHubLoadedConnection> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    const jar = await this.cookieManager.createJar(session);
    return {
      kind: "cookies",
      account: session.account,
      path,
      client: new GitHubApiClient({ jar }),
      connection: {
        account: session.account,
        metadata: session.metadata,
        user: session.user,
      },
      session,
      jar,
    };
  }

  private async loadApiKeyConnection(account?: string): Promise<GitHubLoadedConnection> {
    const loaded = await this.connectionStore.loadApiKeyConnection(this.platform, account);
    if (!loaded.auth.token) {
      throw new MikaCliError("GITHUB_TOKEN_MISSING", "The saved GitHub connection is missing its token.", {
        details: {
          account: loaded.connection.account,
          connectionPath: loaded.path,
        },
      });
    }

    return {
      kind: "apiKey",
      account: loaded.connection.account,
      path: loaded.path,
      client: new GitHubApiClient({ token: loaded.auth.token }),
      connection: {
        account: loaded.connection.account,
        metadata: loaded.connection.metadata,
        user: loaded.connection.user,
      },
      auth: loaded.auth,
    };
  }

  private async validateConnection(loaded: GitHubLoadedConnection): Promise<GitHubLoadedConnection> {
    const viewer = await loaded.client.getViewer();
    const user = this.toSessionUser(viewer);
    const metadata = this.buildMetadata(user, {
      ...(loaded.connection.metadata ?? {}),
      authMode: loaded.kind === "apiKey" ? "apiKey" : "cookies",
      login: viewer.login,
      profileUrl: viewer.html_url,
    });

    if (loaded.kind === "cookies" && loaded.session) {
      loaded.session.user = user;
      loaded.session.metadata = metadata;
    }

    loaded.viewer = viewer;
    loaded.user = user;
    loaded.connection = {
      ...loaded.connection,
      user,
      metadata,
    };

    return loaded;
  }

  private async touchConnection(loaded: GitHubLoadedConnection, message: string): Promise<void> {
    const status = this.activeStatus(message);
    await this.persistConnection(loaded, status);
  }

  private async persistConnection(loaded: GitHubLoadedConnection, status: SessionStatus): Promise<void> {
    if (loaded.kind === "cookies") {
      if (!loaded.session || !loaded.jar) {
        throw new MikaCliError("GITHUB_SESSION_INVALID", "GitHub session data is unavailable for persistence.");
      }

      const session = createSessionFile({
        platform: this.platform,
        account: loaded.connection.account,
        source: loaded.session.source,
        user: loaded.connection.user,
        status,
        metadata: loaded.connection.metadata,
        cookieJar: serializeCookieJar(loaded.jar),
        existingSession: loaded.session,
      });
      await this.cookieManager.saveSession(session);
      loaded.session = session;
      return;
    }

    if (!loaded.auth) {
      throw new MikaCliError("GITHUB_TOKEN_MISSING", "The saved GitHub connection is missing its token.");
    }

    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? this.provider,
      token: loaded.auth.token,
      user: loaded.connection.user,
      status,
      metadata: loaded.connection.metadata,
    });
  }

  private async markConnectionExpired(loaded: GitHubLoadedConnection, error: unknown): Promise<void> {
    const status = this.expiredStatus(error);
    try {
      await this.persistConnection(loaded, status);
    } catch {
      // Best-effort. Validation errors should still surface even if persistence fails.
    }
  }

  private expiredStatus(error: unknown): SessionStatus {
    return {
      state: "expired",
      message: error instanceof MikaCliError ? error.message : `${this.displayName} session validation failed.`,
      lastValidatedAt: new Date().toISOString(),
      ...(error instanceof MikaCliError ? { lastErrorCode: error.code } : {}),
    };
  }

  private validationMessage(): string {
    return this.authMode === "cookies" ? `${this.displayName} web session validated.` : `${this.displayName} token validated.`;
  }

  private buildMetadata(
    user: SessionUser | undefined,
    metadata: Record<string, unknown> = {},
  ): Record<string, unknown> | undefined {
    const result: Record<string, unknown> = {
      ...metadata,
    };

    if (user?.username) {
      result.login = user.username;
    }

    if (user?.profileUrl) {
      result.profileUrl = user.profileUrl;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private summarizeRepo(repo: GitHubRepo): Record<string, unknown> {
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      defaultBranch: repo.default_branch,
      visibility: repo.visibility,
      archived: repo.archived,
      disabled: repo.disabled,
      updatedAt: repo.updated_at,
    };
  }

  private summarizeUser(user: GitHubUser): Record<string, unknown> {
    return {
      id: user.id,
      username: user.login,
      displayName: user.name ?? user.login,
      url: user.html_url,
      avatarUrl: user.avatar_url,
      email: user.email,
      bio: user.bio,
      company: user.company,
      location: user.location,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
    };
  }

  private summarizeBranch(branch: GitHubBranch): Record<string, unknown> {
    return {
      name: branch.name,
      protected: branch.protected,
      commitSha: branch.commit.sha,
      commitUrl: branch.commit.url,
    };
  }

  private summarizeIssue(fullName: string, issue: GitHubIssue): Record<string, unknown> {
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: buildGitHubIssueUrl(fullName, issue.number),
      author: issue.user?.login,
      comments: issue.comments,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      body: issue.body,
    };
  }

  private summarizeComment(comment: GitHubIssueComment): Record<string, unknown> {
    return {
      id: comment.id,
      url: comment.html_url,
      author: comment.user?.login,
      body: comment.body,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
  }

  private summarizePull(pull: GitHubPullRequest): Record<string, unknown> {
    return {
      id: pull.id,
      number: pull.number,
      title: pull.title,
      state: pull.state,
      url: pull.html_url,
      author: pull.user?.login,
      comments: pull.comments,
      commits: pull.commits,
      additions: pull.additions,
      deletions: pull.deletions,
      changedFiles: pull.changed_files,
      draft: pull.draft,
      head: pull.head?.ref,
      base: pull.base?.ref,
      mergedAt: pull.merged_at,
      createdAt: pull.created_at,
      updatedAt: pull.updated_at,
      body: pull.body,
    };
  }

  private summarizeRelease(release: GitHubRelease): Record<string, unknown> {
    return {
      id: release.id,
      tag: release.tag_name,
      name: release.name ?? release.tag_name,
      url: release.html_url,
      draft: release.draft,
      prerelease: release.prerelease,
      createdAt: release.created_at,
      publishedAt: release.published_at,
      body: release.body,
    };
  }

  private summarizeReadme(readme: GitHubReadme, content: string | undefined): Record<string, unknown> {
    return {
      name: readme.name,
      path: readme.path,
      size: readme.size,
      url: readme.html_url,
      downloadUrl: readme.download_url,
      sha: readme.sha,
      content,
    };
  }

  private toSessionUser(viewer: GitHubViewer): SessionUser {
    return {
      id: String(viewer.id),
      username: viewer.login,
      displayName: viewer.name ?? viewer.login,
      profileUrl: viewer.html_url,
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

export const githubAdapter = new GitHubAdapter({
  authMode: "cookies",
});

export const githubBotAdapter = new GitHubAdapter({
  platform: "githubbot",
  displayName: "GitHub Bot",
  provider: "githubbot",
  authMode: "apiKey",
});

function decodeGitHubReadme(readme: GitHubReadme): string | undefined {
  if (!readme.content || readme.encoding !== "base64") {
    return undefined;
  }

  try {
    return Buffer.from(readme.content.replace(/\s+/g, ""), "base64").toString("utf8");
  } catch {
    return undefined;
  }
}
