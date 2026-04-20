import { MikaCliError } from "../../../errors.js";
import { decodeHtml, trimSummary } from "../shared/helpers.js";

import type { AdapterActionResult } from "../../../types.js";

interface TvMazeShow {
  id: number;
  url?: string;
  name?: string;
  type?: string;
  language?: string;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  premiered?: string | null;
  ended?: string | null;
  officialSite?: string | null;
  rating?: {
    average?: number | null;
  } | null;
  network?: {
    name?: string | null;
  } | null;
  webChannel?: {
    name?: string | null;
  } | null;
  image?: {
    medium?: string | null;
    original?: string | null;
  } | null;
  summary?: string | null;
}

interface TvMazeEpisode {
  id: number;
  url?: string;
  name?: string;
  season?: number;
  number?: number;
  airdate?: string | null;
  runtime?: number | null;
  summary?: string | null;
}

interface TvMazeSearchItem {
  score?: number;
  show?: TvMazeShow;
}

interface TvMazeTitleSummary {
  id: number;
  title: string;
  year?: number;
  type?: string;
  language?: string;
  score?: number;
  status?: string;
  network?: string;
  summary?: string;
  imageUrl?: string;
  url: string;
}

interface TvMazeTitleDetails extends TvMazeTitleSummary {
  runtime?: number;
  genres?: string[];
}

export class TvMazeAdapter {
  readonly platform = "tvmaze" as const;
  readonly displayName = "TVMaze";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("TVMAZE_QUERY_REQUIRED", "Provide a show query to search TVMaze.");
    }

    const response = await this.fetchJson<TvMazeSearchItem[]>(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    );
    const items = response
      .map((entry) => entry.show)
      .filter((show): show is TvMazeShow => Boolean(show?.id))
      .slice(0, normalizeLimit(input.limit, 5, 10))
      .map((show) => this.toSummary(show));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} TVMaze result${items.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items,
      },
    };
  }

  async titleInfo(input: { target: string }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("TVMAZE_TARGET_REQUIRED", "Provide a TVMaze show URL, show ID, or query.");
    }

    const show = await this.resolveShow(target);
    const title = this.toTitle(show);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded TVMaze title ${title.title}.`,
      id: String(show.id),
      url: title.url,
      data: {
        title,
      },
    };
  }

  async episodes(input: { target: string; season?: number; limit?: number }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("TVMAZE_TARGET_REQUIRED", "Provide a TVMaze show URL, show ID, or query.");
    }

    const show = await this.resolveShow(target);
    const response = await this.fetchJson<TvMazeEpisode[]>(`https://api.tvmaze.com/shows/${show.id}/episodes`);
    const season = input.season;
    const items = response
      .filter((episode) => (season ? episode.season === season : true))
      .slice(0, normalizeLimit(input.limit, season ? 25 : 10, 100))
      .map((episode) => ({
        id: episode.id,
        title: episode.name ?? `Episode ${episode.number ?? "?"}`,
        season: episode.season ?? undefined,
        number: episode.number ?? undefined,
        airdate: episode.airdate ?? undefined,
        runtime: episode.runtime ?? undefined,
        summary: trimSummary(decodeHtml(episode.summary ?? ""), 280),
        url: episode.url ?? undefined,
      }));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "episodes",
      message: `Loaded ${items.length} TVMaze episode${items.length === 1 ? "" : "s"} for ${show.name ?? "Untitled"}.`,
      id: String(show.id),
      url: show.url ?? `https://www.tvmaze.com/shows/${show.id}`,
      data: {
        title: show.name ?? "Untitled",
        season: season ?? null,
        items,
      },
    };
  }

  private async resolveShow(target: string): Promise<TvMazeShow> {
    const id = extractTvMazeId(target);
    if (id) {
      return this.fetchJson<TvMazeShow>(`https://api.tvmaze.com/shows/${id}`);
    }

    return this.fetchJson<TvMazeShow>(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(target)}`);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "MikaCLI/1.0 (+https://www.tvmaze.com)",
      },
    });

    if (!response.ok) {
      throw new MikaCliError("TVMAZE_REQUEST_FAILED", "TVMaze request failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url,
        },
      });
    }

    return (await response.json()) as T;
  }

  private toSummary(show: TvMazeShow): TvMazeTitleSummary {
    return {
      id: show.id,
      title: show.name ?? "Untitled",
      year: show.premiered ? Number.parseInt(show.premiered.slice(0, 4), 10) : undefined,
      type: show.type ?? undefined,
      language: show.language ?? undefined,
      score: show.rating?.average ?? undefined,
      status: show.status ?? undefined,
      network: show.network?.name ?? show.webChannel?.name ?? undefined,
      summary: trimSummary(decodeHtml(show.summary ?? "")),
      imageUrl: show.image?.original ?? show.image?.medium ?? undefined,
      url: show.url ?? `https://www.tvmaze.com/shows/${show.id}`,
    };
  }

  private toTitle(show: TvMazeShow): TvMazeTitleDetails {
    return {
      id: show.id,
      title: show.name ?? "Untitled",
      year: show.premiered ? Number.parseInt(show.premiered.slice(0, 4), 10) : undefined,
      type: show.type ?? undefined,
      status: show.status ?? undefined,
      score: show.rating?.average ?? undefined,
      runtime: show.runtime ?? show.averageRuntime ?? undefined,
      language: show.language ?? undefined,
      network: show.network?.name ?? show.webChannel?.name ?? undefined,
      genres: show.genres ?? undefined,
      summary: trimSummary(decodeHtml(show.summary ?? ""), 500),
      imageUrl: show.image?.original ?? show.image?.medium ?? undefined,
      url: show.url ?? `https://www.tvmaze.com/shows/${show.id}`,
    };
  }
}

function extractTvMazeId(value: string): number | undefined {
  const match = value.match(/tvmaze\.com\/shows\/(\d+)/) ?? value.match(/^\d+$/);
  const parsed = Number.parseInt(match?.[1] ?? match?.[0] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

export const tvMazeAdapter = new TvMazeAdapter();
