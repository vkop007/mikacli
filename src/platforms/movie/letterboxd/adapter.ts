import { AutoCliError } from "../../../errors.js";
import { fetchPublicHtmlDocument } from "../../tools/shared/html.js";
import { WebSearchClient } from "../../tools/websearch/client.js";
import {
  buildLetterboxdDiaryUrl,
  buildLetterboxdProfileUrl,
  normalizeLetterboxdFilmUrl,
  normalizeLetterboxdUsername,
  parseLetterboxdDiaryFeed,
  parseLetterboxdFilmPage,
  parseLetterboxdProfilePage,
  type LetterboxdSearchItem,
} from "./helpers.js";

import type { AdapterActionResult } from "../../../types.js";

const webSearchClient = new WebSearchClient();
const LETTERBOXD_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export class LetterboxdAdapter {
  readonly platform = "letterboxd" as const;
  readonly displayName = "Letterboxd";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("LETTERBOXD_QUERY_REQUIRED", "Provide a Letterboxd query to search.");
    }

    const limit = normalizeLimit(input.limit, 5, 25);
    const urls = await this.searchFilmUrls(query, limit);
    const items = await this.loadSearchItems(urls, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} Letterboxd result${items.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items,
      },
    };
  }

  async titleInfo(input: { target: string }): Promise<AdapterActionResult> {
    const filmUrl = await this.resolveFilmUrl(input.target);
    const loaded = await this.fetchHtml(filmUrl);
    const title = parseLetterboxdFilmPage(loaded.html, loaded.finalUrl);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded Letterboxd title ${title.title}.`,
      id: title.id,
      url: loaded.finalUrl,
      data: {
        title,
      },
    };
  }

  async profileInfo(input: { target: string }): Promise<AdapterActionResult> {
    const username = normalizeLetterboxdUsername(input.target);
    if (!username) {
      throw new AutoCliError("LETTERBOXD_PROFILE_TARGET_INVALID", "Provide a Letterboxd profile URL or username.");
    }

    const loaded = await this.fetchHtml(buildLetterboxdProfileUrl(username));
    const profile = parseLetterboxdProfilePage(loaded.html, loaded.finalUrl);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "profile",
      message: `Loaded Letterboxd profile ${profile.displayName}.`,
      id: profile.id,
      url: profile.url,
      data: {
        profile,
      },
    };
  }

  async diary(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const username = normalizeLetterboxdUsername(input.target);
    if (!username) {
      throw new AutoCliError("LETTERBOXD_PROFILE_TARGET_INVALID", "Provide a Letterboxd profile URL or username.");
    }

    const limit = normalizeLimit(input.limit, 5, 50);
    const xml = await this.fetchText(buildLetterboxdDiaryUrl(username));
    const items = parseLetterboxdDiaryFeed(xml, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "diary",
      message: `Loaded ${items.length} Letterboxd diary entr${items.length === 1 ? "y" : "ies"} for ${username}.`,
      url: buildLetterboxdProfileUrl(username),
      data: {
        username,
        items,
      },
    };
  }

  private async resolveFilmUrl(target: string): Promise<string> {
    const directUrl = normalizeLetterboxdFilmUrl(target);
    if (directUrl) {
      return directUrl;
    }

    const urls = await this.searchFilmUrls(target, 1);
    const first = urls[0];
    if (!first) {
      throw new AutoCliError("LETTERBOXD_TITLE_NOT_FOUND", "Letterboxd could not find a matching film.", {
        details: {
          target,
        },
      });
    }

    return first;
  }

  private async searchFilmUrls(query: string, limit: number): Promise<string[]> {
    const seen = new Set<string>();
    const urls: string[] = [];

    for (const engine of ["yahoo", "brave", "duckduckgo"] as const) {
      let search;
      try {
        search = await webSearchClient.search({
          engine,
          query: `site:letterboxd.com/film ${query}`,
          limit: Math.max(limit * 4, 10),
          summary: false,
        });
      } catch {
        continue;
      }

      for (const result of search.results) {
        const filmUrl = normalizeLetterboxdFilmUrl(result.url);
        if (!filmUrl || seen.has(filmUrl)) {
          continue;
        }
        seen.add(filmUrl);
        urls.push(filmUrl);
        if (urls.length >= limit) {
          return urls;
        }
      }
    }

    return urls;
  }

  private async loadSearchItems(urls: string[], limit: number): Promise<LetterboxdSearchItem[]> {
    const loaded: Array<LetterboxdSearchItem | undefined> = await Promise.all(
      urls.slice(0, limit).map(async (url) => {
        try {
          const page = await this.fetchHtml(url);
          const title = parseLetterboxdFilmPage(page.html, page.finalUrl);
          return {
            id: title.id,
            title: title.title,
            year: title.year,
            type: "film" as const,
            summary: title.summary,
            url: title.url,
          } satisfies LetterboxdSearchItem;
        } catch {
          return undefined;
        }
      }),
    );

    return loaded.filter((value): value is LetterboxdSearchItem => value !== undefined);
  }

  private async fetchHtml(target: string): Promise<{ html: string; finalUrl: string }> {
    const loaded = await fetchPublicHtmlDocument({
      target,
      errorCode: "LETTERBOXD_REQUEST_FAILED",
      errorLabel: "Letterboxd",
    });

    return {
      html: loaded.html,
      finalUrl: loaded.finalUrl,
    };
  }

  private async fetchText(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "user-agent": LETTERBOXD_USER_AGENT,
          accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      throw new AutoCliError("LETTERBOXD_REQUEST_FAILED", "Failed to reach Letterboxd.", {
        cause: error,
        details: {
          url,
        },
      });
    }

    if (!response.ok) {
      throw new AutoCliError("LETTERBOXD_REQUEST_FAILED", "Letterboxd request failed.", {
        details: {
          url,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    return response.text();
  }
}

export const letterboxdAdapter = new LetterboxdAdapter();

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (!value || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(value)));
}
