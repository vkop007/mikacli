import { CookieJar } from "tough-cookie";

import { sanitizeAccountName } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";
import { CookieManager, createSessionFile, serializeCookieJar } from "../../../utils/cookie-manager.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { normalizeTrelloBoardTarget } from "./helpers.js";
import { TrelloWebClient, type TrelloBoard, type TrelloCard, type TrelloList, type TrelloMember } from "./client.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, Platform, PlatformSession, SessionStatus, SessionUser } from "../../../types.js";

type ActiveTrelloSession = {
  session: PlatformSession;
  path: string;
  jar: CookieJar;
  client: TrelloWebClient;
  viewer: TrelloMember;
};

export class TrelloAdapter {
  readonly platform: Platform = "trello";
  readonly displayName = "Trello";

  private readonly cookieManager = new CookieManager();

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, {
      account: input.account,
      cookieFile: input.cookieFile,
      cookieString: input.cookieString,
      cookieJson: input.cookieJson,
      browser: input.browser,
      browserTimeoutSeconds: input.browserTimeoutSeconds,
      browserUrl: input.browserUrl,
    });
    const client = this.createClient(imported.jar);
    const viewer = await client.getMe();
    const user = this.toSessionUser(viewer);
    const account = input.account
      ? sanitizeAccountName(input.account)
      : sanitizeAccountName(viewer.username || viewer.fullName || viewer.id || "default");
    const status = this.activeStatus("Trello web session validated.");
    const sessionPath = await this.cookieManager.saveSession(
      createSessionFile({
        platform: this.platform,
        account,
        source: imported.source,
        user,
        status,
        metadata: {
          memberId: viewer.id,
          username: viewer.username,
          profileUrl: viewer.url,
        },
        cookieJar: serializeCookieJar(imported.jar),
      }),
    );

    return this.buildResult({
      account,
      action: "login",
      message: `Saved Trello session for ${user.displayName ?? account}.`,
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
        sessionPath: active.path,
        connected: true,
        status: active.session.status.state,
        message: active.session.status.message,
        user: active.session.user,
        lastValidatedAt: active.session.status.lastValidatedAt,
      };
    } catch (error) {
      if (error instanceof MikaCliError && error.code === "TRELLO_SESSION_INVALID") {
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
      message: "Loaded Trello account identity.",
      sessionPath: active.path,
      user: active.session.user,
      data: {
        user: active.session.user,
      },
    });
  }

  async boards(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const boards = await active.client.listBoards(input);
    await this.touchSession(active, "Trello boards loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "boards",
      message: `Loaded ${boards.length} Trello board${boards.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        boards: boards.map((board) => this.summarizeBoard(board)),
      },
    });
  }

  async board(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const board = await active.client.getBoard(target);
    const lists = await active.client.listLists(target).catch(() => []);
    await this.touchSession(active, "Trello board loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "board",
      message: `Loaded Trello board ${board.name}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: board.id,
      url: board.url,
      data: {
        board: {
          ...this.summarizeBoard(board),
          openLists: lists.length,
        },
      },
    });
  }

  async lists(boardTarget: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const board = await active.client.getBoard(boardTarget);
    const lists = await active.client.listLists(boardTarget);
    await this.touchSession(active, "Trello lists loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "lists",
      message: `Loaded ${lists.length} Trello list${lists.length === 1 ? "" : "s"} from ${board.name}.`,
      sessionPath: active.path,
      user: active.session.user,
      url: board.url,
      data: {
        board: this.summarizeBoard(board),
        lists: lists.map((list) => this.summarizeList(list)),
      },
    });
  }

  async cards(input: { board: string; list?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const board = await active.client.getBoard(input.board);
    const cards = await active.client.listCards(input);
    await this.touchSession(active, "Trello cards loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "cards",
      message: `Loaded ${cards.length} Trello card${cards.length === 1 ? "" : "s"} from ${board.name}.`,
      sessionPath: active.path,
      user: active.session.user,
      url: board.url,
      data: {
        board: this.summarizeBoard(board),
        cards: cards.map((card) => this.summarizeCard(card)),
      },
    });
  }

  async card(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const card = await active.client.getCard(target);
    await this.touchSession(active, "Trello card loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "card",
      message: `Loaded Trello card ${card.name}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: card.id,
      url: card.url,
      data: {
        card: this.summarizeCard(card),
      },
    });
  }

  async createCard(input: { board: string; list?: string; name: string; description?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const name = input.name.trim();
    if (!name) {
      throw new MikaCliError("TRELLO_CARD_NAME_REQUIRED", "Trello card name cannot be empty.");
    }

    const card = await active.client.createCard({
      board: input.board,
      list: input.list,
      name,
      description: input.description,
    });
    await this.touchSession(active, "Trello card created.");

    return this.buildResult({
      account: active.session.account,
      action: "create-card",
      message: `Created Trello card ${card.name}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: card.id,
      url: card.url,
      data: {
        card: this.summarizeCard(card),
      },
    });
  }

  private createClient(jar: CookieJar): TrelloWebClient {
    return new TrelloWebClient(new SessionHttpClient(jar));
  }

  private async ensureUsableSession(account?: string): Promise<ActiveTrelloSession> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    return this.validateLoadedSession(session, path);
  }

  private async validateLoadedSession(session: PlatformSession, path: string): Promise<ActiveTrelloSession> {
    const jar = await this.cookieManager.createJar(session);
    const client = this.createClient(jar);
    try {
      const viewer = await client.getMe();
      const nextSession = await this.persistSession(session, jar, {
        user: this.toSessionUser(viewer),
        status: this.activeStatus("Trello web session validated."),
        metadata: {
          ...(session.metadata ?? {}),
          memberId: viewer.id,
          username: viewer.username,
          profileUrl: viewer.url,
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
      await this.markSessionExpired(session, error instanceof MikaCliError ? error.message : "Trello rejected the saved web session. Re-import fresh cookies.");
      throw error instanceof MikaCliError
        ? error
        : new MikaCliError("TRELLO_SESSION_INVALID", "Trello rejected the saved web session. Re-import fresh cookies.", {
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
        lastErrorCode: "TRELLO_SESSION_INVALID",
      },
    });
  }

  private async touchSession(active: ActiveTrelloSession, message: string): Promise<void> {
    active.session = await this.persistSession(active.session, active.jar, {
      status: this.activeStatus(message),
    });
  }

  private toSessionUser(viewer: TrelloMember): SessionUser {
    return {
      id: viewer.id,
      username: viewer.username,
      displayName: viewer.fullName ?? viewer.username ?? viewer.id,
      profileUrl: viewer.url,
    };
  }

  private summarizeBoard(board: TrelloBoard): Record<string, unknown> {
    return {
      id: board.id,
      name: board.name,
      description: board.desc,
      url: board.url,
      shortLink: board.shortLink,
      closed: board.closed,
      updatedAt: board.dateLastActivity,
      organizationId: board.idOrganization,
    };
  }

  private summarizeList(list: TrelloList): Record<string, unknown> {
    return {
      id: list.id,
      boardId: list.idBoard,
      name: list.name,
      closed: list.closed,
      position: list.pos,
    };
  }

  private summarizeCard(card: TrelloCard): Record<string, unknown> {
    return {
      id: card.id,
      boardId: card.idBoard,
      listId: card.idList,
      name: card.name,
      description: card.desc,
      url: card.url,
      shortLink: card.shortLink,
      closed: card.closed,
      due: card.due,
      updatedAt: card.dateLastActivity,
      position: card.pos,
      board: card.board ? this.summarizeBoard(card.board) : undefined,
      list: card.list ? this.summarizeList(card.list) : undefined,
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

export const trelloAdapter = new TrelloAdapter();
