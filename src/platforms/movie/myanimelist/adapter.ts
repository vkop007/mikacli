import { MikaCliError } from "../../../errors.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { decodeHtml, trimSummary } from "../shared/helpers.js";
import { BaseMovieAdapter } from "../shared/base-movie-adapter.js";

import type { AdapterActionResult, PlatformSession } from "../../../types.js";

const MAL_ORIGIN = getPlatformOrigin("myanimelist");
const MAL_HOME = getPlatformHomeUrl("myanimelist");
const MAL_EDIT_PROFILE = "https://myanimelist.net/editprofile.php";
const MAL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

type MalListEntry = {
  anime_id: number;
  anime_title: string;
  anime_url?: string;
  anime_score_val?: number;
  anime_num_episodes?: number;
  num_watched_episodes?: number;
  status?: number;
  score?: number;
  anime_media_type_string?: string;
  anime_image_path?: string;
};

interface MalSearchResult {
  id: number;
  title: string;
  year?: number;
  type?: string;
  episodes?: string;
  score?: string;
  summary?: string;
  url: string;
}

interface MalTitleDetails {
  id: number;
  title: string;
  score?: string;
  ranked?: string;
  popularity?: string;
  members?: string;
  season?: string;
  type?: string;
  studio?: string;
  episodes?: string;
  summary?: string;
  url: string;
}

export class MyAnimeListAdapter extends BaseMovieAdapter {
  readonly platform = "myanimelist" as const;
  readonly targetLabel = "MyAnimeList anime URL, anime ID, or search query";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("MAL_QUERY_REQUIRED", "Provide an anime query to search MyAnimeList.");
    }

    const html = await this.fetchPublicHtml(`https://myanimelist.net/anime.php?q=${encodeURIComponent(query)}&cat=anime`);
    const items = parseMalSearchResults(html).slice(0, normalizeLimit(input.limit, 5, 25));
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} MyAnimeList result${items.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items,
      },
    };
  }

  async titleInfo(input: { target: string }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("MAL_TARGET_REQUIRED", "Provide a MyAnimeList anime URL, anime ID, or search query.");
    }

    const animeId = await this.resolveAnimeId(target);
    const url = `https://myanimelist.net/anime/${animeId}`;
    const html = await this.fetchPublicHtml(url);
    const title = parseMalTitlePage(html, animeId);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded MyAnimeList title ${title.title}.`,
      id: String(animeId),
      url: title.url,
      data: {
        title,
      },
    };
  }

  async list(input: { username?: string; account?: string; limit?: number; status?: string }): Promise<AdapterActionResult> {
    const username = await this.resolveListUsername(input.username, input.account);
    const status = normalizeMalListStatus(input.status);
    const html = await this.fetchPublicHtml(`https://myanimelist.net/animelist/${encodeURIComponent(username)}?status=${status.code}`);
    const entries = parseMalListEntries(html).slice(0, normalizeLimit(input.limit, 25, 100));

    return {
      ok: true,
      platform: this.platform,
      account: input.account ?? username,
      action: "list",
      message: `Loaded ${entries.length} MyAnimeList entr${entries.length === 1 ? "y" : "ies"} for ${username}.`,
      data: {
        username,
        status: status.label,
        items: entries.map((entry) => ({
          id: entry.anime_id,
          title: entry.anime_title,
          progress: entry.num_watched_episodes,
          episodes: entry.anime_num_episodes,
          score: entry.score,
          status: statusName(entry.status),
          type: entry.anime_media_type_string,
          rating: entry.anime_score_val,
          url: entry.anime_url ? `https://myanimelist.net${entry.anime_url}` : `https://myanimelist.net/anime/${entry.anime_id}`,
          imageUrl: entry.anime_image_path,
        })),
      },
    };
  }

  protected async probeSession(session: PlatformSession) {
    const client = await this.createMalClient(session);
    const authCookie =
      (await client.getCookieValue("MALHLOGSESSID", MAL_HOME)) ??
      (await client.getCookieValue("MALSESSIONID", MAL_HOME)) ??
      (await client.getCookieValue("is_logged_in", MAL_HOME));

    if (!authCookie) {
      return {
        status: {
          state: "expired" as const,
          message: "Missing required MyAnimeList auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const { data: html, response } = await client.requestWithResponse<string>(MAL_EDIT_PROFILE, {
        responseType: "text",
        expectedStatus: [200, 303],
        redirect: "manual",
      });

      if (response.status === 303 || response.headers.get("location")?.includes("login_required")) {
        return {
          status: {
            state: "expired" as const,
            message: "MyAnimeList redirected the session to login. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "LOGIN_REQUIRED",
          },
        };
      }

      const username = extractMalUsername(html);
      return {
        status: {
          state: "active" as const,
          message: "Session validated via the MyAnimeList profile editor.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: username ? { username, profileUrl: `https://myanimelist.net/profile/${username}` } : undefined,
      };
    } catch {
      return {
        status: {
          state: "unknown" as const,
          message: "MyAnimeList auth cookies are present, but live validation was limited.",
          lastValidatedAt: new Date().toISOString(),
        },
      };
    }
  }

  private async createMalClient(session: PlatformSession) {
    return this.createClient(session, {
      origin: MAL_ORIGIN,
      referer: MAL_HOME,
      "user-agent": MAL_USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    });
  }

  private async fetchPublicHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        "user-agent": MAL_USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new MikaCliError("MAL_REQUEST_FAILED", "MyAnimeList request failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url,
        },
      });
    }

    return response.text();
  }

  private async resolveAnimeId(target: string): Promise<number> {
    const explicit = extractMalAnimeId(target);
    if (explicit) {
      return explicit;
    }

    const results = parseMalSearchResults(
      await this.fetchPublicHtml(`https://myanimelist.net/anime.php?q=${encodeURIComponent(target)}&cat=anime`),
    );
    const normalized = target.trim().toLowerCase();
    const first =
      results.find((item) => String(item.title).trim().toLowerCase() === normalized) ??
      results.find((item) => typeof item.id === "number") ??
      undefined;

    if (!first || typeof first.id !== "number") {
      throw new MikaCliError("MAL_TITLE_NOT_FOUND", "MyAnimeList could not find a matching anime.", {
        details: {
          target,
        },
      });
    }

    return first.id;
  }

  private async resolveListUsername(username: string | undefined, account: string | undefined): Promise<string> {
    const explicit = username?.trim();
    if (explicit) {
      return explicit.replace(/^@/, "");
    }

    const loaded = await this.ensureAvailableSession(account);
    const fromProbe = loaded.probe.user?.username ?? loaded.session.user?.username;
    if (!fromProbe) {
      throw new MikaCliError(
        "MAL_USERNAME_REQUIRED",
        "Provide a username or import MyAnimeList cookies from a session where the profile editor validates cleanly.",
      );
    }

    return fromProbe;
  }
}

function parseMalSearchResults(html: string): MalSearchResult[] {
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  const results: MalSearchResult[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    if (!row.includes('data-l-module-id="anime-search-result"')) {
      continue;
    }

    const anchorMatch = row.match(
      /class="hoverinfo_trigger fw-b fl-l"[\s\S]*?href="https:\/\/myanimelist\.net\/anime\/(\d+)\/[^"]+"[\s\S]*?<strong>([^<]+)<\/strong>\s*<\/a>/,
    );
    if (!anchorMatch) {
      continue;
    }

    const id = Number.parseInt(anchorMatch[1] ?? "", 10);
    if (!Number.isFinite(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);

    const title = decodeHtml(anchorMatch[2] ?? "");
    const summaryHtml = row.match(/<div class="pt4">([\s\S]*?)<\/div>/)?.[1] ?? "";
    const summary = decodeHtml(summaryHtml.replace(/<a[\s\S]*?>read more\.<\/a>/i, "").trim());
    const cells = Array.from(row.matchAll(/<td class="borderClass ac bgColor\d" width="(\d+)">\s*([^<]*)\s*<\/td>/g));
    const type = decodeHtml(cells[0]?.[2] ?? "");
    const episodes = decodeHtml(cells[1]?.[2] ?? "");
    const score = decodeHtml(cells[2]?.[2] ?? "");

    results.push({
      id,
      title,
      year: undefined,
      type,
      episodes: episodes === "-" ? undefined : episodes,
      score: score === "-" ? undefined : score,
      summary: trimSummary(summary),
      url: `https://myanimelist.net/anime/${id}`,
    });
  }

  return results;
}

function parseMalTitlePage(html: string, animeId: number): MalTitleDetails {
  const title = decodeHtml(html.match(/class="title-name h1_bold_none"><strong>([^<]+)/)?.[1] ?? "");
  if (!title) {
    throw new MikaCliError("MAL_TITLE_PARSE_FAILED", "MyAnimeList returned a title page, but the parser could not extract the title.", {
      details: {
        animeId,
      },
    });
  }

  return {
    id: animeId,
    title,
    score:
      decodeHtml(html.match(/itemprop="ratingValue"[^>]*>([^<]+)/)?.[1] ?? "") ||
      decodeHtml(html.match(/score-label score-\d+">([^<]+)/)?.[1] ?? ""),
    ranked: decodeHtml(html.match(/Ranked <strong>(#[^<]+)<\/strong>/)?.[1] ?? ""),
    popularity: decodeHtml(html.match(/Popularity <strong>(#[^<]+)<\/strong>/)?.[1] ?? ""),
    members: decodeHtml(html.match(/Members <strong>([^<]+)<\/strong>/)?.[1] ?? ""),
    season: decodeHtml(html.match(/class="information season"><a [^>]+>([^<]+)<\/a>/)?.[1] ?? ""),
    type: decodeHtml(html.match(/class="information type"><a [^>]+>([^<]+)<\/a>/)?.[1] ?? ""),
    studio: decodeHtml(html.match(/class="information studio author"><a [^>]+>([^<]+)<\/a>/)?.[1] ?? ""),
    episodes: decodeHtml(html.match(/Episodes:<\/span>\s*([^<]+)/)?.[1] ?? ""),
    summary: trimSummary(decodeHtml(html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? "")),
    url: `https://myanimelist.net/anime/${animeId}`,
  };
}

function parseMalListEntries(html: string): MalListEntry[] {
  const match = html.match(/data-items="([^"]+)"/);
  if (!match?.[1]) {
    throw new MikaCliError("MAL_LIST_PARSE_FAILED", "MyAnimeList list data was not present in the page.", {
      details: {
        reason: "missing_data_items",
      },
    });
  }

  try {
    return JSON.parse(decodeHtml(match[1])) as MalListEntry[];
  } catch (error) {
    throw new MikaCliError("MAL_LIST_PARSE_FAILED", "Failed to parse the MyAnimeList embedded list payload.", {
      cause: error,
    });
  }
}

function extractMalUsername(html: string): string | undefined {
  const match = html.match(/https:\/\/myanimelist\.net\/profile\/([^"?#/]+)/);
  return match?.[1];
}

function extractMalAnimeId(value: string): number | undefined {
  const idMatch = value.match(/myanimelist\.net\/anime\/(\d+)/) ?? value.match(/\b(\d{1,10})\b/);
  const parsed = Number.parseInt(idMatch?.[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function normalizeMalListStatus(input: string | undefined): { code: number; label: string } {
  const normalized = input?.trim().toLowerCase();
  switch (normalized) {
    case "watching":
    case "current":
      return { code: 1, label: "watching" };
    case "completed":
      return { code: 2, label: "completed" };
    case "onhold":
    case "on-hold":
      return { code: 3, label: "on-hold" };
    case "dropped":
      return { code: 4, label: "dropped" };
    case "plan":
    case "plantowatch":
    case "plan-to-watch":
      return { code: 6, label: "plan-to-watch" };
    default:
      return { code: 7, label: "all" };
  }
}

function statusName(status: number | undefined): string {
  switch (status) {
    case 1:
      return "watching";
    case 2:
      return "completed";
    case 3:
      return "on-hold";
    case 4:
      return "dropped";
    case 6:
      return "plan-to-watch";
    default:
      return "-";
  }
}

export const myAnimeListAdapter = new MyAnimeListAdapter();
