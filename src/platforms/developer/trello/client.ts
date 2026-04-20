import { MikaCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { matchesTrelloQuery, normalizeTrelloBoardTarget, normalizeTrelloCardTarget } from "./helpers.js";

export type TrelloMember = {
  id: string;
  username?: string;
  fullName?: string;
  url?: string;
  initials?: string;
};

export type TrelloBoard = {
  id: string;
  name: string;
  desc?: string;
  url?: string;
  shortLink?: string;
  closed?: boolean;
  dateLastActivity?: string;
  idOrganization?: string;
  prefs?: Record<string, unknown>;
};

export type TrelloList = {
  id: string;
  idBoard?: string;
  name: string;
  closed?: boolean;
  pos?: number;
};

export type TrelloCard = {
  id: string;
  idBoard?: string;
  idList?: string;
  name: string;
  desc?: string;
  url?: string;
  shortLink?: string;
  closed?: boolean;
  due?: string | null;
  dateLastActivity?: string;
  pos?: number;
  board?: TrelloBoard;
  list?: TrelloList;
};

const TRELLO_API_BASE_URL = "https://trello.com/1";

export class TrelloWebClient {
  constructor(private readonly http: SessionHttpClient) {}

  async getMe(): Promise<TrelloMember> {
    return this.request<TrelloMember>("/members/me?fields=id,username,fullName,url,initials");
  }

  async listBoards(input: { query?: string; limit?: number }): Promise<TrelloBoard[]> {
    const boards = await this.request<TrelloBoard[]>(
      `/members/me/boards?filter=open&fields=id,name,desc,url,shortLink,closed,dateLastActivity,idOrganization,prefs`,
    );

    return boards.filter((board) => matchesTrelloQuery({ name: board.name, description: board.desc }, input.query)).slice(0, clamp(input.limit ?? 20, 1, 100));
  }

  async getBoard(target: string): Promise<TrelloBoard> {
    return this.request<TrelloBoard>(
      `/boards/${encodeURIComponent(normalizeTrelloBoardTarget(target))}?fields=id,name,desc,url,shortLink,closed,dateLastActivity,idOrganization,prefs`,
    );
  }

  async listLists(boardTarget: string): Promise<TrelloList[]> {
    return this.request<TrelloList[]>(
      `/boards/${encodeURIComponent(normalizeTrelloBoardTarget(boardTarget))}/lists?filter=open&fields=id,idBoard,name,closed,pos`,
    );
  }

  async listCards(input: { board: string; list?: string; limit?: number }): Promise<TrelloCard[]> {
    const cards = await this.request<TrelloCard[]>(
      `/boards/${encodeURIComponent(normalizeTrelloBoardTarget(input.board))}/cards?filter=open&fields=id,idBoard,idList,name,desc,url,shortLink,closed,due,dateLastActivity,pos`,
    );
    const filtered = input.list?.trim()
      ? await this.filterCardsByList(cards, input.board, input.list)
      : cards;
    return filtered.slice(0, clamp(input.limit ?? 20, 1, 100));
  }

  async getCard(target: string): Promise<TrelloCard> {
    return this.request<TrelloCard>(
      `/cards/${encodeURIComponent(normalizeTrelloCardTarget(target))}?fields=id,idBoard,idList,name,desc,url,shortLink,closed,due,dateLastActivity,pos&board=true&list=true`,
    );
  }

  async createCard(input: { board: string; list?: string; name: string; description?: string }): Promise<TrelloCard> {
    const lists = await this.listLists(input.board);
    const list = resolveTrelloList(lists, input.list);
    const body = new URLSearchParams({
      idList: list.id,
      name: input.name,
      ...(input.description?.trim() ? { desc: input.description.trim() } : {}),
      pos: "top",
    });

    const created = await this.request<TrelloCard>("/cards", {
      method: "POST",
      body,
      expectedStatus: [200],
    });

    return this.getCard(created.id ?? created.shortLink ?? input.name);
  }

  private async filterCardsByList(cards: TrelloCard[], board: string, listReference: string): Promise<TrelloCard[]> {
    const lists = await this.listLists(board);
    const list = resolveTrelloList(lists, listReference);
    return cards.filter((card) => card.idList === list.id);
  }

  private async request<T>(
    path: string,
    input: {
      method?: string;
      body?: URLSearchParams;
      expectedStatus?: number[];
    } = {},
  ): Promise<T> {
    try {
      const { data } = await this.http.requestWithResponse<string>(`${TRELLO_API_BASE_URL}${path}`, {
        method: input.method ?? "GET",
        responseType: "text",
        expectedStatus: input.expectedStatus ?? [200],
        headers: {
          accept: "application/json",
          ...(input.body ? { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" } : {}),
          "x-requested-with": "XMLHttpRequest",
          "x-trello-client-version": "1.0.0",
          "user-agent": "MikaCLI",
        },
        ...(input.body ? { body: input.body.toString() } : {}),
      });

      const text = data.trim();
      if (!text) {
        return {} as T;
      }
      if (text.startsWith("<")) {
        throw new MikaCliError("TRELLO_SESSION_INVALID", "Trello redirected the saved web session to HTML. Re-import fresh cookies.", {
          details: { preview: text.slice(0, 200) },
        });
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new MikaCliError("TRELLO_RESPONSE_INVALID", "Trello returned a non-JSON response.", {
          cause: error,
          details: { preview: text.slice(0, 200) },
        });
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): MikaCliError {
    if (!(error instanceof MikaCliError)) {
      return new MikaCliError("TRELLO_REQUEST_FAILED", "Trello request failed.", { cause: error });
    }

    if (error.code !== "HTTP_REQUEST_FAILED") {
      return error;
    }

    const status = typeof error.details?.status === "number" ? error.details.status : undefined;
    const body = typeof error.details?.body === "string" ? error.details.body : "";
    const code =
      status === 400 || status === 422 ? "TRELLO_VALIDATION_FAILED"
      : status === 401 ? "TRELLO_SESSION_INVALID"
      : status === 403 ? "TRELLO_FORBIDDEN"
      : status === 404 ? "TRELLO_NOT_FOUND"
      : status === 429 ? "TRELLO_RATE_LIMITED"
      : "TRELLO_REQUEST_FAILED";

    const upstream = body.trim() || error.message;
    const message =
      code === "TRELLO_SESSION_INVALID" ? "Trello rejected the saved web session. Re-import fresh cookies."
      : code === "TRELLO_FORBIDDEN" ? "Trello denied access to that resource."
      : code === "TRELLO_NOT_FOUND" ? "Trello could not find that resource."
      : code === "TRELLO_RATE_LIMITED" ? "Trello rate limited the request. Try again later."
      : code === "TRELLO_VALIDATION_FAILED" ? `Trello rejected the request: ${upstream}`
      : `Trello request failed${status ? ` with HTTP ${status}` : ""}.`;

    return new MikaCliError(code, message, {
      cause: error,
      details: {
        status,
        upstreamMessage: upstream.slice(0, 200),
      },
    });
  }
}

function resolveTrelloList(lists: TrelloList[], reference?: string): TrelloList {
  if (!lists[0]) {
    throw new MikaCliError("TRELLO_LIST_NOT_FOUND", "No open Trello lists were available on that board.");
  }

  if (!reference?.trim()) {
    return lists[0];
  }

  const normalized = reference.trim().toLowerCase();
  const match = lists.find((list) => list.id.toLowerCase() === normalized || list.name.toLowerCase() === normalized);
  if (!match) {
    throw new MikaCliError("TRELLO_LIST_NOT_FOUND", `Could not find a Trello list matching "${reference}".`);
  }

  return match;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
