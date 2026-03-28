import { CookieJar } from "tough-cookie";

import { AutoCliError } from "../../../errors.js";
import { CookieManager, createSessionFile, serializeCookieJar } from "../../../utils/cookie-manager.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { LinearWebClient, type LinearComment, type LinearIssue, type LinearProject, type LinearTeam, type LinearUser } from "./client.js";
import { normalizeLinearAccountName, normalizeLinearReference, sanitizeLinearSummaryText } from "./helpers.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, Platform, PlatformSession, SessionStatus, SessionUser } from "../../../types.js";

type ActiveLinearSession = {
  session: PlatformSession;
  path: string;
  jar: CookieJar;
  client: LinearWebClient;
  viewer: LinearUser;
};

export class LinearAdapter {
  readonly platform: Platform = "linear";
  readonly displayName = "Linear";

  private readonly cookieManager = new CookieManager();

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, {
      cookieFile: input.cookieFile,
      cookieString: input.cookieString,
      cookieJson: input.cookieJson,
    });

    const client = this.createClient(imported.jar);
    const viewer = await client.getViewer();
    const account = normalizeLinearAccountName(viewer.name ?? viewer.email ?? viewer.id ?? "default");
    const user = this.toSessionUser(viewer);
    const status = this.activeStatus("Linear web session validated.");
    const sessionPath = await this.cookieManager.saveSession(
      createSessionFile({
        platform: this.platform,
        account,
        source: imported.source,
        user,
        status,
        metadata: {
          email: viewer.email,
        },
        cookieJar: serializeCookieJar(imported.jar),
      }),
    );

    return this.buildResult({
      account,
      action: "login",
      message: `Saved Linear session for ${user.displayName ?? account}.`,
      sessionPath,
      user,
      data: {
        user,
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    try {
      const active = await this.validateLoadedSession(session, path);
      return {
        platform: this.platform,
        account: active.session.account,
        sessionPath: path,
        connected: true,
        status: active.session.status.state,
        message: active.session.status.message,
        user: active.session.user,
        lastValidatedAt: active.session.status.lastValidatedAt,
      };
    } catch (error) {
      if (error instanceof AutoCliError && error.code === "LINEAR_SESSION_INVALID") {
        const expired = await this.markSessionExpired(session, error.message);
        return {
          platform: this.platform,
          account: expired.account,
          sessionPath: path,
          connected: false,
          status: expired.status.state,
          message: expired.status.message,
          user: expired.user,
          lastValidatedAt: expired.status.lastValidatedAt,
        };
      }

      throw error;
    }
  }

  async me(): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    return this.buildResult({
      account: active.session.account,
      action: "me",
      message: "Loaded Linear account identity.",
      sessionPath: active.path,
      user: active.session.user,
      data: {
        user: {
          ...active.session.user,
          email: active.viewer.email,
        },
      },
    });
  }

  async teams(input: { limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const teams = await active.client.listTeams({ limit: input.limit });
    await this.touchSession(active, "Linear teams loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "teams",
      message: `Loaded ${teams.length} team${teams.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        teams: teams.map((team) => this.summarizeTeam(team)),
      },
    });
  }

  async projects(input: { limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const projects = await active.client.listProjects({ limit: input.limit });
    await this.touchSession(active, "Linear projects loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "projects",
      message: `Loaded ${projects.length} project${projects.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        projects: projects.map((project) => this.summarizeProject(project)),
      },
    });
  }

  async issues(input: { team?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const teamId = input.team ? await this.resolveTeamId(active.client, input.team) : undefined;
    const issues = await active.client.listIssues({ teamId, limit: input.limit });
    await this.touchSession(active, "Linear issues loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "issues",
      message: `Loaded ${issues.length} issue${issues.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        team: teamId,
        issues: issues.map((issue) => this.summarizeIssue(issue)),
      },
    });
  }

  async issue(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const issue = await active.client.getIssue(normalizeLinearReference(target));
    await this.touchSession(active, "Linear issue loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "issue",
      message: `Loaded issue ${issue.identifier}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: issue.id,
      data: {
        issue: this.summarizeIssue(issue),
      },
    });
  }

  async createIssue(input: { team: string; title: string; description?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const teamId = await this.resolveTeamId(active.client, input.team);
    const title = input.title.trim();
    if (!title) {
      throw new AutoCliError("LINEAR_TITLE_REQUIRED", "Issue title cannot be empty.");
    }

    const issue = await active.client.createIssue({
      teamId,
      title,
      description: sanitizeLinearSummaryText(input.description),
    });
    await this.touchSession(active, "Linear issue created.");

    return this.buildResult({
      account: active.session.account,
      action: "create-issue",
      message: `Created issue ${issue.identifier}.`,
      sessionPath: active.path,
      user: active.session.user,
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

    const active = await this.ensureUsableSession();
    const issue = await active.client.updateIssue({
      id: normalizeLinearReference(input.target),
      title: input.title?.trim() || undefined,
      description: sanitizeLinearSummaryText(input.description),
      stateId: input.stateId?.trim() || undefined,
    });
    await this.touchSession(active, "Linear issue updated.");

    return this.buildResult({
      account: active.session.account,
      action: "update-issue",
      message: `Updated issue ${issue.identifier}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: issue.id,
      data: {
        issue: this.summarizeIssue(issue),
      },
    });
  }

  async comment(input: { target: string; body: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const issue = await active.client.getIssue(normalizeLinearReference(input.target));
    const body = input.body.trim();
    if (!body) {
      throw new AutoCliError("LINEAR_COMMENT_EMPTY", "Comment body cannot be empty.");
    }

    const comment = await active.client.createComment({
      issueId: issue.id,
      body,
    });
    await this.touchSession(active, "Linear comment created.");

    return this.buildResult({
      account: active.session.account,
      action: "comment",
      message: `Added a comment to issue ${issue.identifier}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: comment.id,
      data: {
        issue: this.summarizeIssue(issue),
        comment: this.summarizeComment(comment),
      },
    });
  }

  private createClient(jar: CookieJar): LinearWebClient {
    return new LinearWebClient(new SessionHttpClient(jar));
  }

  private async ensureUsableSession(account?: string): Promise<ActiveLinearSession> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    return this.validateLoadedSession(session, path);
  }

  private async validateLoadedSession(session: PlatformSession, path: string): Promise<ActiveLinearSession> {
    const jar = await this.cookieManager.createJar(session);
    const client = this.createClient(jar);
    try {
      const viewer = await client.getViewer();
      const nextSession = await this.persistSession(session, jar, {
        user: this.toSessionUser(viewer),
        status: this.activeStatus("Linear web session validated."),
        metadata: {
          ...(session.metadata ?? {}),
          email: viewer.email,
        },
      });
      return {
        session: nextSession,
        path,
        jar,
        client,
        viewer,
      };
    } catch (error) {
      await this.markSessionExpired(session, error instanceof AutoCliError ? error.message : "Linear rejected the saved web session. Re-import fresh cookies.");
      throw error instanceof AutoCliError
        ? error
        : new AutoCliError("LINEAR_SESSION_INVALID", "Linear rejected the saved web session. Re-import fresh cookies.", {
            cause: error,
          });
    }
  }

  private async persistSession(
    existingSession: PlatformSession,
    jar: CookieJar,
    input: {
      user?: SessionUser;
      status?: SessionStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PlatformSession> {
    const nextSession = createSessionFile({
      platform: this.platform,
      account: existingSession.account,
      source: existingSession.source,
      user: input.user ?? existingSession.user,
      status: input.status ?? existingSession.status,
      metadata: input.metadata ?? existingSession.metadata,
      cookieJar: serializeCookieJar(jar),
      existingSession,
    });
    await this.cookieManager.saveSession(nextSession);
    return nextSession;
  }

  private async markSessionExpired(session: PlatformSession, message: string): Promise<PlatformSession> {
    const jar = await this.cookieManager.createJar(session);
    return this.persistSession(session, jar, {
      status: {
        state: "expired",
        message,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: "LINEAR_SESSION_INVALID",
      },
    });
  }

  private async touchSession(active: ActiveLinearSession, message: string): Promise<void> {
    active.session = await this.persistSession(active.session, active.jar, {
      status: this.activeStatus(message),
    });
  }

  private async resolveTeamId(client: LinearWebClient, reference: string): Promise<string> {
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
