import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";
import { LinearApiClient, type LinearComment, type LinearIssue, type LinearProject, type LinearTeam, type LinearUser } from "./client.js";
import { normalizeLinearAccountName, normalizeLinearReference, normalizeLinearToken, sanitizeLinearSummaryText } from "./helpers.js";

type LinearLoadedConnection = Awaited<ReturnType<ConnectionStore["loadApiKeyConnection"]>>;

export class LinearAdapter {
  readonly platform: Platform = "linear";
  readonly displayName = "Linear";

  private readonly connectionStore = new ConnectionStore();

  async loginWithToken(input: { token: string }): Promise<AdapterActionResult> {
    const apiKey = normalizeLinearToken(input.token);
    const client = new LinearApiClient({ apiKey });
    const viewer = await client.getViewer();
    const account = normalizeLinearAccountName(viewer.name ?? viewer.email ?? viewer.id ?? "default");
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus("Linear API key validated.");
    const sessionPath = await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account,
      provider: "linear",
      token: apiKey,
      user,
      status,
      metadata: {
        email: viewer.email,
      },
    });

    return this.buildResult({
      account,
      action: "login",
      message: `Saved Linear token for ${user.displayName ?? account}.`,
      sessionPath,
      user,
      data: {
        user,
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account);
    const client = this.createClient(loaded.auth.token);
    const viewer = await client.getViewer();
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus("Linear API key validated.");
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "linear",
      token: loaded.auth.token,
      user,
      status,
      metadata: {
        ...(loaded.connection.metadata ?? {}),
        email: viewer.email,
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
    const client = this.createClient(loaded.auth.token);
    const viewer = await client.getViewer();
    const user = this.toSessionUser(viewer);
    await this.touchConnection(loaded, user, "Linear identity loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "me",
      message: "Loaded Linear account identity.",
      sessionPath: loaded.path,
      user,
      data: {
        user: {
          ...user,
          email: viewer.email,
        },
      },
    });
  }

  async teams(input: { limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const teams = await client.listTeams({ limit: input.limit });
    await this.touchConnection(loaded, loaded.connection.user, "Linear teams loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "teams",
      message: `Loaded ${teams.length} team${teams.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        teams: teams.map((team) => this.summarizeTeam(team)),
      },
    });
  }

  async projects(input: { limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const projects = await client.listProjects({ limit: input.limit });
    await this.touchConnection(loaded, loaded.connection.user, "Linear projects loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "projects",
      message: `Loaded ${projects.length} project${projects.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        projects: projects.map((project) => this.summarizeProject(project)),
      },
    });
  }

  async issues(input: { team?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const teamId = input.team ? await this.resolveTeamId(client, input.team) : undefined;
    const issues = await client.listIssues({ teamId, limit: input.limit });
    await this.touchConnection(loaded, loaded.connection.user, "Linear issues loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "issues",
      message: `Loaded ${issues.length} issue${issues.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        team: teamId,
        issues: issues.map((issue) => this.summarizeIssue(issue)),
      },
    });
  }

  async issue(target: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const issue = await client.getIssue(normalizeLinearReference(target));
    await this.touchConnection(loaded, loaded.connection.user, "Linear issue loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "issue",
      message: `Loaded issue ${issue.identifier}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: issue.id,
      data: {
        issue: this.summarizeIssue(issue),
      },
    });
  }

  async createIssue(input: { team: string; title: string; description?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const teamId = await this.resolveTeamId(client, input.team);
    const title = input.title.trim();
    if (!title) {
      throw new AutoCliError("LINEAR_TITLE_REQUIRED", "Issue title cannot be empty.");
    }

    const issue = await client.createIssue({
      teamId,
      title,
      description: sanitizeLinearSummaryText(input.description),
    });
    await this.touchConnection(loaded, loaded.connection.user, "Linear issue created.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "create-issue",
      message: `Created issue ${issue.identifier}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: issue.id,
      data: {
        issue: this.summarizeIssue(issue),
      },
    });
  }

  async updateIssue(input: { target: string; title?: string; description?: string; stateId?: string }): Promise<AdapterActionResult> {
    if (!input.title && !input.description && !input.stateId) {
      throw new AutoCliError("LINEAR_UPDATE_EMPTY", "Provide --title, --description, or --state-id to update the issue.");
    }

    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const issue = await client.updateIssue({
      id: normalizeLinearReference(input.target),
      title: input.title?.trim() || undefined,
      description: sanitizeLinearSummaryText(input.description),
      stateId: input.stateId?.trim() || undefined,
    });
    await this.touchConnection(loaded, loaded.connection.user, "Linear issue updated.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "update-issue",
      message: `Updated issue ${issue.identifier}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: issue.id,
      data: {
        issue: this.summarizeIssue(issue),
      },
    });
  }

  async comment(input: { target: string; body: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const issue = await client.getIssue(normalizeLinearReference(input.target));
    const body = input.body.trim();
    if (!body) {
      throw new AutoCliError("LINEAR_COMMENT_EMPTY", "Comment body cannot be empty.");
    }

    const comment = await client.createComment({
      issueId: issue.id,
      body,
    });
    await this.touchConnection(loaded, loaded.connection.user, "Linear comment created.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "comment",
      message: `Added a comment to issue ${issue.identifier}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: comment.id,
      data: {
        issue: this.summarizeIssue(issue),
        comment: this.summarizeComment(comment),
      },
    });
  }

  private createClient(token: string): LinearApiClient {
    return new LinearApiClient({ apiKey: token });
  }

  private async loadConnection(account?: string): Promise<LinearLoadedConnection> {
    const loaded = await this.connectionStore.loadApiKeyConnection(this.platform, account);
    if (!loaded.auth.token) {
      throw new AutoCliError("LINEAR_TOKEN_MISSING", "The saved Linear connection is missing its token.", {
        details: {
          account: loaded.connection.account,
          connectionPath: loaded.path,
        },
      });
    }

    return loaded;
  }

  private async touchConnection(loaded: LinearLoadedConnection, user: SessionUser | undefined, message: string): Promise<void> {
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "linear",
      token: loaded.auth.token,
      user,
      status: this.activeStatus(message),
      metadata: loaded.connection.metadata,
    });
  }

  private async resolveTeamId(client: LinearApiClient, reference: string): Promise<string> {
    const teams = await client.listTeams({ limit: 100 });
    const normalized = reference.trim().toLowerCase();
    const team = teams.find((candidate) =>
      candidate.id.toLowerCase() === normalized ||
      candidate.key.toLowerCase() === normalized ||
      candidate.name.toLowerCase() === normalized,
    );

    if (!team) {
      throw new AutoCliError("LINEAR_TEAM_NOT_FOUND", `Could not find a Linear team matching "${reference}".`, {
        details: {
          reference,
        },
      });
    }

    return team.id;
  }

  private summarizeTeam(team: LinearTeam): Record<string, unknown> {
    return {
      id: team.id,
      key: team.key,
      name: team.name,
      description: team.description,
    };
  }

  private summarizeProject(project: LinearProject): Record<string, unknown> {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
    };
  }

  private summarizeIssue(issue: LinearIssue): Record<string, unknown> {
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      state: issue.state,
      team: issue.team,
    };
  }

  private summarizeComment(comment: LinearComment): Record<string, unknown> {
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: comment.user,
    };
  }

  private toSessionUser(user: LinearUser): SessionUser {
    return {
      id: user.id,
      username: user.email ?? user.id,
      displayName: user.name ?? user.email ?? user.id,
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

export const linearAdapter = new LinearAdapter();
