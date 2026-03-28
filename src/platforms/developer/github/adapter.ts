import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";
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

type GitHubLoadedConnection = Awaited<ReturnType<ConnectionStore["loadApiKeyConnection"]>>;

type GitHubAdapterOptions = {
  platform?: Platform;
  displayName?: string;
  provider?: string;
};

export class GitHubAdapter {
  readonly platform: Platform;
  readonly displayName: string;

  private readonly connectionStore = new ConnectionStore();
  private readonly provider: string;

  constructor(options: GitHubAdapterOptions = {}) {
    this.platform = options.platform ?? "github";
    this.displayName = options.displayName ?? "GitHub";
    this.provider = options.provider ?? this.platform;
  }

  async loginWithToken(input: { token: string; account?: string }): Promise<AdapterActionResult> {
    const token = normalizeGitHubToken(input.token);
    const client = new GitHubApiClient({ token });
    const viewer = await client.getViewer();
    const account = input.account?.trim() || viewer.login;
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus(`${this.displayName} personal access token validated.`);
    const sessionPath = await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account,
      provider: this.provider,
      token,
      user,
      status,
      metadata: {
        login: viewer.login,
        profileUrl: viewer.html_url,
      },
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

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account);
    const client = this.createClient(loaded.auth.token);
    const viewer = await client.getViewer();
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus(`${this.displayName} token validated.`);
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? this.provider,
      token: loaded.auth.token,
      user,
      status,
      metadata: {
        ...(loaded.connection.metadata ?? {}),
        login: viewer.login,
        profileUrl: viewer.html_url,
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

  async me(account?: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(account);
    const client = this.createClient(loaded.auth.token);
    const viewer = await client.getViewer();
    const user = this.toSessionUser(viewer);
    await this.touchConnection(loaded, user, `${this.displayName} token validated.`);

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
    const client = this.createClient(loaded.auth.token);
    const user = await client.getUser(login.trim());
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} user loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const repos = input.owner
      ? await client.listUserRepos({ owner: input.owner, limit: input.limit, sort: input.sort })
      : await client.listViewerRepos({ limit: input.limit, sort: input.sort, type: input.type });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} repositories loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "repos",
      message: `Loaded ${repos.length} ${this.displayName} repositor${repos.length === 1 ? "y" : "ies"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        owner: input.owner,
        repos: repos.map((repo) => this.summarizeRepo(repo)),
      },
    });
  }

  async repo(input: { account?: string; target: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection(input.account);
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.target);
    const repo = await client.getRepo(fullName);
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} repository loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const repos = await client.listStarredRepos({
      owner: input.owner,
      limit: input.limit,
      sort: input.sort,
      direction: input.direction,
    });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} starred repositories loaded.`);

    return this.buildResult({
      account: loaded.connection.account,
      action: "starred",
      message: `Loaded ${repos.length} starred ${this.displayName} repositor${repos.length === 1 ? "y" : "ies"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        owner: input.owner,
        repos: repos.map((repo) => this.summarizeRepo(repo)),
      },
    });
  }

  async branches(input: { repo: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const branches = await client.listBranches({ fullName, limit: input.limit });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} branches loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const branch = await client.getBranch({ fullName, branch: input.branch });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} branch loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const search = await client.searchRepos({
      query: input.query,
      limit: input.limit,
      sort: input.sort,
      order: input.order,
    });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} repository search completed.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const issues = (await client.listIssues({ fullName, state: input.state, limit: input.limit })).filter((issue) => !issue.pull_request);
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} issues loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const pulls = await client.listPulls({
      fullName,
      state: input.state,
      limit: input.limit,
      sort: input.sort,
      direction: input.direction,
    });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} pull requests loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const pull = await client.getPull({ fullName, pullNumber: input.number });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} pull request loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const issue = await client.getIssue({ fullName, issueNumber: input.number });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} issue loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const comment = await client.createIssueComment({
      fullName,
      issueNumber: input.number,
      body: input.body.trim(),
    });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} issue comment created.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const issue = await client.createIssue({ fullName, title: input.title.trim(), body: input.body?.trim() });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} issue created.`);

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
    const client = this.createClient(loaded.auth.token);
    const repo = await client.createRepo({
      name: input.name.trim(),
      description: input.description?.trim(),
      private: input.private,
      homepage: input.homepage?.trim(),
      autoInit: input.autoInit,
    });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} repository created.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const repo = await client.forkRepo(fullName);
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} repository fork created.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const releases = await client.listReleases({ fullName, limit: input.limit });
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} releases loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    const readme = await client.getReadme(fullName);
    const content = decodeGitHubReadme(readme);
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} README loaded.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    await client.starRepo(fullName);
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} repository starred.`);

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
    const client = this.createClient(loaded.auth.token);
    const { fullName } = parseGitHubRepoTarget(input.repo);
    await client.unstarRepo(fullName);
    await this.touchConnection(loaded, loaded.connection.user, `${this.displayName} repository unstarred.`);

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

  private createClient(token: string): GitHubApiClient {
    return new GitHubApiClient({ token });
  }

  private async loadConnection(account?: string): Promise<GitHubLoadedConnection> {
    const loaded = await this.connectionStore.loadApiKeyConnection(this.platform, account);
    if (!loaded.auth.token) {
      throw new AutoCliError("GITHUB_TOKEN_MISSING", "The saved GitHub connection is missing its token.", {
        details: {
          account: loaded.connection.account,
          connectionPath: loaded.path,
        },
      });
    }
    return loaded;
  }

  private async touchConnection(loaded: GitHubLoadedConnection, user: SessionUser | undefined, message: string): Promise<void> {
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? this.provider,
      token: loaded.auth.token,
      user,
      status: this.activeStatus(message),
      metadata: loaded.connection.metadata,
    });
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

export const githubAdapter = new GitHubAdapter();
export const githubBotAdapter = new GitHubAdapter({
  platform: "githubbot",
  displayName: "GitHub Bot",
  provider: "githubbot",
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
