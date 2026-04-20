import { MikaCliError } from "../../../errors.js";

import type { AdapterActionResult } from "../../../types.js";

const IMDB_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface ImdbSuggestionResponse {
  d?: ImdbSuggestionItem[];
}

interface ImdbSuggestionItem {
  id?: string;
  l?: string;
  q?: string;
  qid?: string;
  y?: number;
  s?: string;
  rank?: number;
  i?: {
    imageUrl?: string;
  };
}

export class ImdbAdapter {
  readonly platform = "imdb" as const;
  readonly displayName = "IMDb";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("IMDB_QUERY_REQUIRED", "Provide a movie or show query to search IMDb.");
    }

    const items = (await this.fetchSuggestions(query)).slice(0, normalizeLimit(input.limit, 5, 10));
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} IMDb result${items.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items: items.map((item) => this.toSummary(item)),
      },
    };
  }

  async titleInfo(input: { target: string }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("IMDB_TARGET_REQUIRED", "Provide an IMDb title URL, title ID, or search query.");
    }

    let item: ImdbSuggestionItem | undefined;
    const id = extractImdbId(target);
    if (id) {
      item = (await this.fetchSuggestions(id)).find((entry) => entry.id === id);
    } else {
      const items = await this.fetchSuggestions(target);
      const normalized = target.toLowerCase();
      item =
        items.find((entry) => entry.l?.trim().toLowerCase() === normalized) ??
        items.find((entry) => entry.id === extractImdbId(entry.id ?? "")) ??
        items[0];
    }

    if (!item?.id || !item.l) {
      throw new MikaCliError("IMDB_TITLE_NOT_FOUND", "IMDb could not find a matching title.", {
        details: {
          target,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded IMDb title ${item.l}.`,
      id: item.id,
      url: `https://www.imdb.com/title/${item.id}/`,
      data: {
        title: {
          id: item.id,
          title: item.l,
          year: item.y,
          type: item.q ?? item.qid,
          cast: item.s,
          rank: item.rank,
          imageUrl: item.i?.imageUrl,
        },
      },
    };
  }

  private async fetchSuggestions(query: string): Promise<ImdbSuggestionItem[]> {
    const normalized = query.trim();
    const bucket = firstSuggestionBucket(normalized);
    const url = `https://v3.sg.media-imdb.com/suggestion/${bucket}/${encodeURIComponent(normalized)}.json`;
    const response = await fetch(url, {
      headers: {
        "user-agent": IMDB_USER_AGENT,
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new MikaCliError("IMDB_REQUEST_FAILED", "IMDb search request failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url,
        },
      });
    }

    const data = (await response.json()) as ImdbSuggestionResponse;
    return (data.d ?? []).filter((item): item is ImdbSuggestionItem => typeof item?.id === "string" && typeof item?.l === "string");
  }

  private toSummary(item: ImdbSuggestionItem): Record<string, unknown> {
    return {
      id: item.id,
      title: item.l,
      year: item.y,
      type: item.q ?? item.qid,
      cast: item.s,
      rank: item.rank,
      imageUrl: item.i?.imageUrl,
      url: item.id ? `https://www.imdb.com/title/${item.id}/` : undefined,
    };
  }
}

function firstSuggestionBucket(value: string): string {
  const first = value.trim().charAt(0).toLowerCase();
  return /^[a-z0-9]$/.test(first) ? first : "x";
}

function extractImdbId(value: string): string | undefined {
  const match = value.match(/tt\d{5,}/);
  return match?.[0];
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

export const imdbAdapter = new ImdbAdapter();
