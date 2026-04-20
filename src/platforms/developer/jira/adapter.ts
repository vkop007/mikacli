import { CookieJar } from "tough-cookie";

import { sanitizeAccountName } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";
import { CookieManager, createSessionFile, serializeCookieJar } from "../../../utils/cookie-manager.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { JiraWebClient, type JiraIssue, type JiraProject, type JiraUser } from "./client.js";
import { adfToPlainText, buildJiraIssueUrl, buildJiraProjectUrl, getStoredJiraSiteUrl, inferJiraSiteUrlFromJar, normalizeJiraProjectTarget, normalizeJiraSiteUrl } from "./helpers.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, Platform, PlatformSession, SessionStatus, SessionUser } from "../../../types.js";

type ActiveJiraSession = {
  session: PlatformSession;
  path: string;
  jar: CookieJar;
  client: JiraWebClient;
  viewer: JiraUser;
  siteUrl: string;
};

export class JiraAdapter {
  readonly platform: Platform = "jira";
  readonly displayName = "Jira";

  private readonly cookieManager = new CookieManager();

  async login(input: LoginInput & { site?: string }): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, {
      account: input.account,
      cookieFile: input.cookieFile,
      cookieString: input.cookieString,
      cookieJson: input.cookieJson,
      browser: input.browser,
      browserTimeoutSeconds: input.browserTimeoutSeconds,
      browserUrl: input.site ?? input.browserUrl,
    });
    const siteUrl = await this.resolveSiteUrl(imported.jar, input.site);
    const client = this.createClient(imported.jar, siteUrl);
    const viewer = await client.getViewer();
    const user = this.toSessionUser(viewer, siteUrl);
    const account = input.account
      ? sanitizeAccountName(input.account)
      : sanitizeAccountName(viewer.emailAddress?.split("@")[0] || viewer.displayName || viewer.accountId || "default");
    const status = this.activeStatus("Jira web session validated.");
    const sessionPath = await this.cookieManager.saveSession(
      createSessionFile({
        platform: this.platform,
        account,
        source: imported.source,
        user,
        status,
        metadata: {
          siteUrl,
          accountId: viewer.accountId,
          email: viewer.emailAddress,
        },
        cookieJar: serializeCookieJar(imported.jar),
      }),
    );

    return this.buildResult({
      account,
      action: "login",
      message: `Saved Jira session for ${user.displayName ?? account}.`,
      sessionPath,
      user,
      data: {
        siteUrl,
        user: {
          ...user,
          email: viewer.emailAddress,
        },
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
        sessionPath: active.path,
        connected: true,
        status: active.session.status.state,
        message: active.session.status.message,
        user: active.session.user,
        lastValidatedAt: active.session.status.lastValidatedAt,
      };
    } catch (error) {
      if (error instanceof MikaCliError && error.code === "JIRA_SESSION_INVALID") {
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
      message: "Loaded Jira account identity.",
      sessionPath: active.path,
      user: active.session.user,
      data: {
        siteUrl: active.siteUrl,
        user: {
          ...active.session.user,
          email: active.viewer.emailAddress,
          active: active.viewer.active,
        },
      },
    });
  }

  async projects(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const projects = await active.client.listProjects({ query: input.query, limit: input.limit });
    await this.touchSession(active, "Jira projects loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "projects",
      message: `Loaded ${projects.length} Jira project${projects.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        query: input.query,
        siteUrl: active.siteUrl,
        projects: projects.map((project) => this.summarizeProject(project, active.siteUrl)),
      },
    });
  }

  async project(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const project = await active.client.getProject(target);
    await this.touchSession(active, "Jira project loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "project",
      message: `Loaded Jira project ${project.key}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: project.id,
      url: buildJiraProjectUrl(active.siteUrl, project.key),
      data: {
        siteUrl: active.siteUrl,
        project: this.summarizeProject(project, active.siteUrl),
      },
    });
  }

  async issues(input: { project?: string; jql?: string; state?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const issues = await active.client.searchIssues(input);
    await this.touchSession(active, "Jira issues loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "issues",
      message: `Loaded ${issues.length} Jira issue${issues.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        siteUrl: active.siteUrl,
        project: input.project ? normalizeJiraProjectTarget(input.project) : undefined,
        jql: input.jql,
        issues: issues.map((issue) => this.summarizeIssue(issue, active.siteUrl)),
      },
    });
  }

  async issue(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const issue = await active.client.getIssue(target);
    await this.touchSession(active, "Jira issue loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "issue",
      message: `Loaded Jira issue ${issue.key}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: issue.id,
      url: buildJiraIssueUrl(active.siteUrl, issue.key),
      data: {
        siteUrl: active.siteUrl,
        issue: this.summarizeIssue(issue, active.siteUrl),
      },
    });
  }

  async createIssue(input: { project: string; summary: string; description?: string; issueType?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const summary = input.summary.trim();
    if (!summary) {
      throw new MikaCliError("JIRA_SUMMARY_REQUIRED", "Jira issue summary cannot be empty.");
    }

    const issue = await active.client.createIssue({
      project: input.project,
      summary,
      description: input.description,
      issueType: input.issueType,
    });
    await this.touchSession(active, "Jira issue created.");

    return this.buildResult({
      account: active.session.account,
      action: "create-issue",
      message: `Created Jira issue ${issue.key}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: issue.id,
      url: buildJiraIssueUrl(active.siteUrl, issue.key),
      data: {
        siteUrl: active.siteUrl,
        issue: this.summarizeIssue(issue, active.siteUrl),
      },
    });
  }

  private createClient(jar: CookieJar, siteUrl: string): JiraWebClient {
    return new JiraWebClient(new SessionHttpClient(jar), siteUrl);
  }

  private async ensureUsableSession(account?: string): Promise<ActiveJiraSession> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    return this.validateLoadedSession(session, path);
  }

  private async validateLoadedSession(session: PlatformSession, path: string): Promise<ActiveJiraSession> {
    const jar = await this.cookieManager.createJar(session);
    const siteUrl = await this.resolveSiteUrl(jar, getStoredJiraSiteUrl(session.metadata));
    const client = this.createClient(jar, siteUrl);
    try {
      const viewer = await client.getViewer();
      const nextSession = await this.persistSession(session, jar, {
        user: this.toSessionUser(viewer, siteUrl),
        status: this.activeStatus("Jira web session validated."),
        metadata: {
          ...(session.metadata ?? {}),
          siteUrl,
          accountId: viewer.accountId,
          email: viewer.emailAddress,
        },
      });
      return {
        session: nextSession,
        path,
        jar,
        client,
        viewer,
        siteUrl,
      };
    } catch (error) {
      await this.markSessionExpired(session, error instanceof MikaCliError ? error.message : "Jira rejected the saved web session. Re-import fresh cookies.");
      throw error instanceof MikaCliError
        ? error
        : new MikaCliError("JIRA_SESSION_INVALID", "Jira rejected the saved web session. Re-import fresh cookies.", {
            cause: error,
          });
    }
  }

  private async resolveSiteUrl(jar: CookieJar, preferred?: string): Promise<string> {
    if (preferred?.trim()) {
      return normalizeJiraSiteUrl(preferred);
    }

    const inferred = await inferJiraSiteUrlFromJar(jar);
    if (inferred) {
      return inferred;
    }

    throw new MikaCliError("JIRA_SITE_REQUIRED", "Could not infer the Jira site from the imported cookies. Re-run login with --site https://your-workspace.atlassian.net.");
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
        lastErrorCode: "JIRA_SESSION_INVALID",
      },
    });
  }

  private async touchSession(active: ActiveJiraSession, message: string): Promise<void> {
    active.session = await this.persistSession(active.session, active.jar, {
      status: this.activeStatus(message),
    });
  }

  private toSessionUser(viewer: JiraUser, siteUrl: string): SessionUser {
    return {
      id: viewer.accountId,
      username: viewer.emailAddress,
      displayName: viewer.displayName,
      profileUrl: `${siteUrl}/jira/people/${viewer.accountId}`,
    };
  }

  private summarizeProject(project: JiraProject, siteUrl: string): Record<string, unknown> {
    return {
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      url: buildJiraProjectUrl(siteUrl, project.key),
      projectType: project.projectTypeKey,
      simplified: project.simplified,
      style: project.style,
      lead: project.lead?.displayName,
      issueTypes: Array.isArray(project.issueTypes)
        ? project.issueTypes.map((issueType) => ({
            id: issueType.id,
            name: issueType.name,
            subtask: issueType.subtask,
          }))
        : undefined,
    };
  }

  private summarizeIssue(issue: JiraIssue, siteUrl: string): Record<string, unknown> {
    return {
      id: issue.id,
      key: issue.key,
      title: issue.fields.summary,
      description: adfToPlainText(issue.fields.description),
      url: buildJiraIssueUrl(siteUrl, issue.key),
      projectKey: issue.fields.project?.key,
      projectName: issue.fields.project?.name,
      issueType: issue.fields.issuetype?.name,
      state: issue.fields.status?.name,
      stateCategory: issue.fields.status?.statusCategory?.name,
      assignee: issue.fields.assignee?.displayName ?? issue.fields.assignee?.emailAddress,
      reporter: issue.fields.reporter?.displayName ?? issue.fields.reporter?.emailAddress,
      priority: issue.fields.priority?.name,
      labels: issue.fields.labels,
      createdAt: issue.fields.created,
      updatedAt: issue.fields.updated,
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
    sessionPath?: string;
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
      ...(input.sessionPath ? { sessionPath: input.sessionPath } : {}),
      ...(input.user ? { user: input.user } : {}),
      ...(input.id ? { id: input.id } : {}),
      ...(input.url ? { url: input.url } : {}),
      ...(input.data ? { data: input.data } : {}),
    };
  }
}

export const jiraAdapter = new JiraAdapter();
