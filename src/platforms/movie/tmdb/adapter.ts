import { MikaCliError } from "../../../errors.js";
import { decodeHtml, trimSummary } from "../shared/helpers.js";

import type { AdapterActionResult } from "../../../types.js";

type TmdbTitleType = "movie" | "tv";

interface TmdbSearchItem {
  id: string;
  title: string;
  year?: number;
  type: TmdbTitleType;
  summary?: string;
  url: string;
}

const TMDB_ORIGIN = "https://www.themoviedb.org";
const TMDB_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export class TmdbAdapter {
  readonly platform = "tmdb" as const;
  readonly displayName = "TMDb";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("TMDB_QUERY_REQUIRED", "Provide a TMDb query to search.");
    }

    const html = await this.fetchHtml(`${TMDB_ORIGIN}/search?query=${encodeURIComponent(query)}&language=en-US`);
    const items = parseTmdbSearchResults(html).slice(0, normalizeTmdbLimit(input.limit, 5, 25));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} TMDb result${items.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items,
      },
    };
  }

  async titleInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = await this.resolveTitleTarget(input.target);
    const html = await this.fetchHtml(resolved.url);
    const title = parseTmdbTitlePage(html, resolved);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded TMDb title ${title.title}.`,
      id: resolved.id,
      url: resolved.url,
      data: {
        title,
      },
    };
  }

  async recommendations(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = await this.resolveTitleTarget(input.target);
    const html = await this.fetchHtml(`${TMDB_ORIGIN}${resolved.path}/remote/recommendations?language=en-US`);
    const items = parseTmdbRecommendationCards(html).slice(0, normalizeTmdbLimit(input.limit, 5, 25));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "recommendations",
      message: `Loaded ${items.length} TMDb recommendation${items.length === 1 ? "" : "s"} for ${resolved.title}.`,
      data: {
        target: resolved.title,
        items,
      },
    };
  }

  async trending(input: { limit?: number }): Promise<AdapterActionResult> {
    const html = await this.fetchHtml(`${TMDB_ORIGIN}/movie?language=en-US`);
    const items = parseTmdbTrendingCards(html).slice(0, normalizeTmdbLimit(input.limit, 10, 25));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "trending",
      message: `Loaded ${items.length} popular TMDb movie${items.length === 1 ? "" : "s"}.`,
      data: {
        items,
      },
    };
  }

  private async resolveTitleTarget(target: string): Promise<{ id: string; title: string; type: TmdbTitleType; path: string; url: string }> {
    const trimmed = target.trim();
    if (!trimmed) {
      throw new MikaCliError("TMDB_TARGET_REQUIRED", "Provide a TMDb URL, numeric title ID, or search query.");
    }

    const parsed = parseTmdbTarget(trimmed);
    if (parsed) {
      return parsed;
    }

    const html = await this.fetchHtml(`${TMDB_ORIGIN}/search?query=${encodeURIComponent(trimmed)}&language=en-US`);
    const first = parseTmdbSearchResults(html)[0];
    if (!first) {
      throw new MikaCliError("TMDB_TITLE_NOT_FOUND", "TMDb could not find a matching title.", {
        details: {
          target,
        },
      });
    }

    const resolved = parseTmdbTarget(first.url);
    if (!resolved) {
      throw new MikaCliError("TMDB_TITLE_NOT_FOUND", "TMDb returned an unreadable title target.", {
        details: {
          target,
          url: first.url,
        },
      });
    }

    return {
      ...resolved,
      title: first.title,
    };
  }

  private async fetchHtml(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "user-agent": TMDB_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      throw new MikaCliError("TMDB_REQUEST_FAILED", "Failed to load TMDb.", {
        cause: error,
        details: {
          url,
        },
      });
    }

    if (!response.ok) {
      throw new MikaCliError("TMDB_REQUEST_FAILED", "TMDb request failed.", {
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

function parseTmdbTarget(target: string): { id: string; title: string; type: TmdbTitleType; path: string; url: string } | undefined {
  const trimmed = target.trim();
  const urlMatch = trimmed.match(/themoviedb\.org\/(movie|tv)\/(\d+)(-[^?#]+)?/i);
  if (urlMatch?.[1] && urlMatch[2]) {
    const type = urlMatch[1] as TmdbTitleType;
    const path = `/${type}/${urlMatch[2]}${urlMatch[3] ?? ""}`;
    return {
      id: urlMatch[2],
      title: urlMatch[3]?.replace(/^-/, "").replace(/-/g, " ") ?? urlMatch[2],
      type,
      path,
      url: buildTmdbUrl(path),
    };
  }

  if (/^\d+$/.test(trimmed)) {
    const path = `/movie/${trimmed}`;
    return {
      id: trimmed,
      title: trimmed,
      type: "movie",
      path,
      url: buildTmdbUrl(path),
    };
  }

  return undefined;
}

function parseTmdbSearchResults(html: string): TmdbSearchItem[] {
  const items: TmdbSearchItem[] = [];
  const pattern =
    /data-media-type="(movie|tv)".*?href="\/(movie|tv)\/(\d+)(-[^"?]*)?\?language=en-US".*?<h2><span>(.*?)<\/span>(?:<span class="title">\s+\((.*?)\)<\/span>)?<\/h2><\/a><\/div><span class="release_date">(.*?)<\/span>.*?<div class="overview"><p>(.*?)<\/p>/gms;

  for (const match of html.matchAll(pattern)) {
    const type = (match[1] ?? match[2]) as TmdbTitleType;
    const id = match[3];
    if (!type || !id) {
      continue;
    }

    const slug = match[4] ?? "";
    const primaryTitle = decodeHtml(match[5] ?? "");
    const altTitle = decodeHtml(match[6] ?? "");
    const title = altTitle ? `${primaryTitle} (${altTitle})` : primaryTitle;

    items.push({
      id,
      title,
      year: extractYear(match[7]),
      type,
      summary: trimSummary(decodeHtml(match[8] ?? ""), 220),
      url: buildTmdbUrl(`/${type}/${id}${slug}`),
    });
  }

  return dedupeTmdbItems(items);
}

function parseTmdbTitlePage(
  html: string,
  resolved: { id: string; title: string; type: TmdbTitleType; url: string },
): Record<string, unknown> {
  const titleMatch = html.match(/<h2[^>]*>\s*<a href="\/(?:movie|tv)\/\d+[^"]*">([^<]+)<\/a>\s*<span class="tag release_date">\((\d{4})\)<\/span>/i);
  const title = decodeHtml(titleMatch?.[1] ?? resolved.title);
  const genres = Array.from(html.matchAll(/<span class="genres">([\s\S]*?)<\/span>/g), (match) =>
    Array.from((match[1] ?? "").matchAll(/<a [^>]*>([^<]+)<\/a>/g), (genre) => decodeHtml(genre[1] ?? "").trim()).filter(Boolean),
  )
    .flat()
    .slice(0, 6);
  const runtime = decodeHtml(html.match(/<span class="runtime">\s*([^<]+)\s*<\/span>/i)?.[1] ?? "");
  const score = html.match(/user_score_chart[^>]*data-percent="(\d+)"/i)?.[1];
  const tagline = decodeHtml(html.match(/<h3 class="tagline"[^>]*>([^<]+)<\/h3>/i)?.[1] ?? "");
  const overview = decodeHtml(html.match(/<div class="overview"[^>]*>\s*<p>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const cast = Array.from(html.matchAll(/<p><a href="\/person\/\d+[^"]*">([^<]+)<\/a><\/p>\s*<p class="character">([^<]+)<\/p>/g), (match) =>
    `${decodeHtml(match[1] ?? "").trim()}${match[2] ? ` (${decodeHtml(match[2]).trim()})` : ""}`,
  ).slice(0, 8);

  return {
    title,
    year: titleMatch?.[2] ? Number.parseInt(titleMatch[2], 10) : undefined,
    type: resolved.type,
    status: decodeHtml(html.match(/<strong><bdi>Status<\/bdi><\/strong>\s*([^<]+)/i)?.[1] ?? ""),
    score: score ? `${score}%` : undefined,
    runtime: runtime || undefined,
    language: decodeHtml(html.match(/<strong><bdi>Original Language<\/bdi><\/strong>\s*([^<]+)/i)?.[1] ?? ""),
    genres: genres.length > 0 ? genres : undefined,
    cast: cast.length > 0 ? cast : undefined,
    tagline: tagline || undefined,
    budget: decodeHtml(html.match(/<strong><bdi>Budget<\/bdi><\/strong>\s*([^<]+)/i)?.[1] ?? ""),
    revenue: decodeHtml(html.match(/<strong><bdi>Revenue<\/bdi><\/strong>\s*([^<]+)/i)?.[1] ?? ""),
    summary: trimSummary([tagline || undefined, overview || undefined].filter(Boolean).join(" — "), 500),
    url: resolved.url,
  };
}

function parseTmdbRecommendationCards(html: string): TmdbSearchItem[] {
  const items: TmdbSearchItem[] = [];
  const pattern =
    /<a href="\/(movie|tv)\/(\d+)(-[^"]*)?" title="([^"]+)"[^>]*>[\s\S]*?<span class="release_date">[\s\S]*?(\d{2}\/\d{2}\/\d{4})<\/span>[\s\S]*?<a class="title" href="\/(?:movie|tv)\/\d+[^"]*"[^>]*><bdi>(.*?)<\/bdi><\/a>[\s\S]*?<span class="vote_average">(\d+)<span class="percent">%<\/span><\/span>/gms;

  for (const match of html.matchAll(pattern)) {
    const type = match[1] as TmdbTitleType;
    const id = match[2];
    if (!type || !id) {
      continue;
    }

    const slug = match[3] ?? "";
    const title = decodeHtml(match[6] ?? match[4] ?? "");
    items.push({
      id,
      title,
      year: extractYear(match[5]),
      type,
      summary: [match[5], `${match[7]}% user score`].filter(Boolean).join(" • "),
      url: buildTmdbUrl(`/${type}/${id}${slug}`),
    });
  }

  return dedupeTmdbItems(items);
}

function parseTmdbTrendingCards(html: string): TmdbSearchItem[] {
  const items: TmdbSearchItem[] = [];
  const pattern = /<div class="options" data-id="(\d+)"[^>]*data-media-type="movie">[\s\S]*?<h2><a href="\/movie\/\d+[^"]*" title="([^"]+)">([^<]+)<\/a><\/h2>\s*<p>([^<]+)<\/p>/gms;

  for (const match of html.matchAll(pattern)) {
    const id = match[1];
    const title = decodeHtml(match[3] ?? match[2] ?? "");
    if (!id || !title) {
      continue;
    }

    items.push({
      id,
      title,
      year: extractYear(match[4]),
      type: "movie",
      summary: match[4]?.trim(),
      url: buildTmdbUrl(`/movie/${id}`),
    });
  }

  return dedupeTmdbItems(items);
}

function normalizeTmdbLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

function extractYear(value: string | undefined): number | undefined {
  const match = value?.match(/(\d{4})/);
  const parsed = Number.parseInt(match?.[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildTmdbUrl(path: string): string {
  if (path.includes("?language=")) {
    return `${TMDB_ORIGIN}${path}`;
  }

  return `${TMDB_ORIGIN}${path}?language=en-US`;
}

function dedupeTmdbItems(items: TmdbSearchItem[]): TmdbSearchItem[] {
  const seen = new Set<string>();
  const deduped: TmdbSearchItem[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export const tmdbAdapter = new TmdbAdapter();
