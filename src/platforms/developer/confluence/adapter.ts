import { CookieJar } from "tough-cookie";

import { sanitizeAccountName } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";
import { CookieManager, createSessionFile, serializeCookieJar } from "../../../utils/cookie-manager.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { buildConfluencePageUrl, getStoredConfluenceSiteUrl, inferConfluenceSiteUrlFromJar, normalizeConfluencePageTarget, normalizeConfluenceSiteUrl } from "./helpers.js";
import { ConfluenceWebClient, type ConfluenceComment, type ConfluencePage, type ConfluenceSpace, type ConfluenceUser } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, Platform, PlatformSession, SessionStatus, SessionUser } from "../../../types.js";

type ActiveConfluenceSession = {
  session: PlatformSession;
  path: string;
  jar: CookieJar;
  client: ConfluenceWebClient;
  viewer: ConfluenceUser;
  siteUrl: string;
};

export class ConfluenceAdapter {
  readonly platform: Platform = "confluence";
  readonly displayName = "Confluence";

  private readonly cookieManager = new CookieManager();

  async login(input: LoginInput & { site?: string }): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, {
      cookieFile: input.cookieFile,
      cookieString: input.cookieString,
      cookieJson: input.cookieJson,
    });
    const siteUrl = await this.resolveSiteUrl(imported.jar, input.site);
    const client = this.createClient(imported.jar, siteUrl);
    const viewer = await client.getViewer();
    const user = this.toSessionUser(viewer, siteUrl);
    const account = input.account
      ? sanitizeAccountName(input.account)
      : sanitizeAccountName(viewer.email || viewer.publicName || viewer.displayName || viewer.accountId || "default");
    const status = this.activeStatus("Confluence web session validated.");
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
          email: viewer.email,
        },
        cookieJar: serializeCookieJar(imported.jar),
      }),
    );

    return this.buildResult({
      account,
      action: "login",
      message: `Saved Confluence session for ${user.displayName ?? account}.`,
      sessionPath,
      user,
      data: {
        siteUrl,
        user: {
          ...user,
          email: viewer.email,
          type: viewer.accountType ?? viewer.type,
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
      if (error instanceof AutoCliError && error.code === "CONFLUENCE_SESSION_INVALID") {
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
      message: "Loaded Confluence account identity.",
      sessionPath: active.path,
      user: active.session.user,
      data: {
        siteUrl: active.siteUrl,
        user: {
          ...active.session.user,
          email: active.viewer.email,
          type: active.viewer.accountType ?? active.viewer.type,
        },
      },
    });
  }

  async spaces(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const spaces = await active.client.listSpaces(input);
    await this.touchSession(active, "Confluence spaces loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "spaces",
      message: `Loaded ${spaces.length} Confluence space${spaces.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        siteUrl: active.siteUrl,
        query: input.query,
        spaces: spaces.map((space) => active.client.summarizeSpace(space)),
      },
    });
  }

  async search(input: { query: string; space?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("CONFLUENCE_QUERY_REQUIRED", "Provide a Confluence search query.");
    }

    const items = await active.client.searchPages({
      query,
      space: input.space,
      limit: input.limit,
    });
    await this.touchSession(active, "Confluence search completed.");

    return this.buildResult({
      account: active.session.account,
      action: "search",
      message: `Loaded ${items.length} Confluence page${items.length === 1 ? "" : "s"} for "${query}".`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        siteUrl: active.siteUrl,
        query,
        space: input.space,
        items: items.map((page) => active.client.summarizePage(page)),
      },
    });
  }

  async page(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const page = await this.resolvePage(active, target);
    await this.touchSession(active, "Confluence page loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "page",
      message: `Loaded Confluence page ${page.title}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: page.id,
      url: buildConfluencePageUrl(active.siteUrl, page.id),
      data: {
        siteUrl: active.siteUrl,
        page: active.client.summarizePage(page),
      },
    });
  }

  async children(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const page = await this.resolvePage(active, input.target);
    const children = await active.client.listChildren(page.id, input.limit);
    await this.touchSession(active, "Confluence child pages loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "children",
      message: `Loaded ${children.length} child page${children.length === 1 ? "" : "s"} for ${page.title}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: page.id,
      url: buildConfluencePageUrl(active.siteUrl, page.id),
      data: {
        siteUrl: active.siteUrl,
        parent: active.client.summarizePage(page),
        items: children.map((child) => active.client.summarizePage(child)),
      },
    });
  }

  async createPage(input: { space: string; title: string; parent?: string; body?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const created = await active.client.createPage({
      space: input.space,
      title: input.title,
      parentId: input.parent,
      body: input.body,
    });
    await this.touchSession(active, "Confluence page created.");

    return this.buildResult({
      account: active.session.account,
      action: "create-page",
      message: `Created Confluence page ${created.title}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: created.id,
      url: buildConfluencePageUrl(active.siteUrl, created.id),
      data: {
        siteUrl: active.siteUrl,
        page: active.client.summarizePage(created),
      },
    });
  }

  async updatePage(input: { target: string; title?: string; body?: string; minorEdit?: boolean }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const updated = await active.client.updatePage({
      target: await this.resolvePageId(active, input.target),
      title: input.title,
      body: input.body,
      minorEdit: input.minorEdit,
    });
    await this.touchSession(active, "Confluence page updated.");

    return this.buildResult({
      account: active.session.account,
      action: "update-page",
      message: `Updated Confluence page ${updated.title}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: updated.id,
      url: buildConfluencePageUrl(active.siteUrl, updated.id),
      data: {
        siteUrl: active.siteUrl,
        page: active.client.summarizePage(updated),
      },
    });
  }

  async comment(input: { target: string; text: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const pageId = await this.resolvePageId(active, input.target);
    const page = await active.client.getPage(pageId);
    const comment = await active.client.createComment({
      target: pageId,
      text: input.text,
    });
    await this.touchSession(active, "Confluence comment created.");

    return this.buildResult({
      account: active.session.account,
      action: "comment",
      message: `Commented on Confluence page ${page.title}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: comment.id,
      url: buildConfluencePageUrl(active.siteUrl, page.id),
      data: {
        siteUrl: active.siteUrl,
        page: active.client.summarizePage(page),
        comment: active.client.summarizeComment(comment, page.id),
      },
    });
  }

  private createClient(jar: CookieJar, siteUrl: string): ConfluenceWebClient {
    return new ConfluenceWebClient(new SessionHttpClient(jar), siteUrl);
  }

  private async ensureUsableSession(account?: string): Promise<ActiveConfluenceSession> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    return this.validateLoadedSession(session, path);
  }

  private async validateLoadedSession(session: PlatformSession, path: string): Promise<ActiveConfluenceSession> {
    const jar = await this.cookieManager.createJar(session);
    const siteUrl = await this.resolveSiteUrl(jar, getStoredConfluenceSiteUrl(session.metadata));
    const client = this.createClient(jar, siteUrl);
    try {
      const viewer = await client.getViewer();
      const nextSession = await this.persistSession(session, jar, {
        user: this.toSessionUser(viewer, siteUrl),
        status: this.activeStatus("Confluence web session validated."),
        metadata: {
          ...(session.metadata ?? {}),
          siteUrl,
          accountId: viewer.accountId,
          email: viewer.email,
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
      await this.markSessionExpired(session, error instanceof AutoCliError ? error.message : "Confluence rejected the saved web session. Re-import fresh cookies.");
      throw error instanceof AutoCliError
        ? error
        : new AutoCliError("CONFLUENCE_SESSION_INVALID", "Confluence rejected the saved web session. Re-import fresh cookies.", {
            cause: error,
          });
    }
  }

  private async resolveSiteUrl(jar: CookieJar, preferred?: string): Promise<string> {
    if (preferred?.trim()) {
      return normalizeConfluenceSiteUrl(preferred);
    }

    const inferred = await inferConfluenceSiteUrlFromJar(jar);
    if (inferred) {
      return inferred;
    }

    throw new AutoCliError(
      "CONFLUENCE_SITE_REQUIRED",
      "Could not infer the Confluence site from the imported cookies. Re-run login with --site https://your-workspace.atlassian.net/wiki.",
    );
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
        lastErrorCode: "CONFLUENCE_SESSION_INVALID",
      },
    });
  }

  private async touchSession(active: ActiveConfluenceSession, message: string): Promise<void> {
    active.session = await this.persistSession(active.session, active.jar, {
      status: this.activeStatus(message),
    });
  }

  private async resolvePage(active: ActiveConfluenceSession, target: string): Promise<ConfluencePage> {
    const pageId = await this.resolvePageId(active, target);
    return active.client.getPage(pageId);
  }

  private async resolvePageId(active: ActiveConfluenceSession, target: string): Promise<string> {
    try {
      return normalizeConfluencePageTarget(target);
    } catch {
      const query = target.trim();
      if (!query) {
        throw new AutoCliError("CONFLUENCE_PAGE_TARGET_INVALID", "Confluence page target cannot be empty.");
      }

      const match = await active.client.searchPages({ query, limit: 1 });
      const first = match[0];
      if (!first?.id) {
        throw new AutoCliError("CONFLUENCE_PAGE_NOT_FOUND", `Confluence could not find a page for "${target}".`, {
          details: {
            target,
          },
        });
      }

      return first.id;
    }
  }

  private toSessionUser(viewer: ConfluenceUser, siteUrl: string): SessionUser {
    return {
      id: viewer.accountId,
      username: viewer.email,
      displayName: viewer.displayName ?? viewer.publicName,
      profileUrl: `${siteUrl}/people/${viewer.accountId}`,
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

export const confluenceAdapter = new ConfluenceAdapter();
