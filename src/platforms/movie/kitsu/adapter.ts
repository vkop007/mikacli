import { MikaCliError } from "../../../errors.js";
import { trimSummary } from "../shared/helpers.js";

import type { AdapterActionResult } from "../../../types.js";

interface KitsuAnimeAttributes {
  canonicalTitle?: string;
  abbreviatedTitles?: string[];
  titles?: Record<string, string>;
  slug?: string;
  averageRating?: string;
  startDate?: string;
  synopsis?: string;
  subtype?: string;
  status?: string;
  episodeCount?: number;
  posterImage?: {
    original?: string;
    large?: string;
    small?: string;
  };
}

interface KitsuAnimeResource {
  id: string;
  type: "anime";
  attributes: KitsuAnimeAttributes;
}

interface KitsuResponse {
  data?: KitsuAnimeResource | KitsuAnimeResource[];
}

interface KitsuTitleSummary {
  id: string;
  title: string;
  year?: number;
  type?: string;
  score?: string;
  status?: string;
  episodes?: number;
  summary?: string;
  imageUrl?: string;
  url: string;
}

interface KitsuTitleDetails extends KitsuTitleSummary {
  altTitles?: string[];
}

export class KitsuAdapter {
  readonly platform = "kitsu" as const;
  readonly displayName = "Kitsu";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("KITSU_QUERY_REQUIRED", "Provide an anime query to search Kitsu.");
    }

    const limit = normalizeLimit(input.limit, 5, 10);
    const response = await this.fetchJson(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=${limit}`,
    );
    const items = asArray(response.data).map((entry) => this.toSummary(entry));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} Kitsu result${items.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items,
      },
    };
  }

  async titleInfo(input: { target: string }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("KITSU_TARGET_REQUIRED", "Provide a Kitsu anime URL, anime ID, or search query.");
    }

    const anime = await this.resolveAnime(target);
    const title = this.toTitle(anime);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded Kitsu title ${title.title}.`,
      id: anime.id,
      url: title.url,
      data: {
        title,
      },
    };
  }

  private async resolveAnime(target: string): Promise<KitsuAnimeResource> {
    const id = extractKitsuId(target);
    if (id) {
      const response = await this.fetchJson(`https://kitsu.io/api/edge/anime/${id}`);
      const resource = response.data;
      if (!resource || Array.isArray(resource)) {
        throw new MikaCliError("KITSU_TITLE_NOT_FOUND", "Kitsu could not find that anime ID.", {
          details: { target },
        });
      }
      return resource;
    }

    const slug = extractKitsuSlug(target);
    if (slug) {
      const response = await this.fetchJson(`https://kitsu.io/api/edge/anime?filter[slug]=${encodeURIComponent(slug)}&page[limit]=1`);
      const resource = asArray(response.data)[0];
      if (!resource) {
        throw new MikaCliError("KITSU_TITLE_NOT_FOUND", "Kitsu could not find that anime slug.", {
          details: { target },
        });
      }
      return resource;
    }

    const response = await this.fetchJson(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(target)}&page[limit]=5`);
    const results = asArray(response.data);
    const normalized = target.toLowerCase();
    const exact =
      results.find((entry) => pickKitsuTitle(entry.attributes).toLowerCase() === normalized) ??
      results.find((entry) => entry.attributes.slug?.toLowerCase() === normalized) ??
      results[0];

    if (!exact) {
      throw new MikaCliError("KITSU_TITLE_NOT_FOUND", "Kitsu could not find a matching anime.", {
        details: { target },
      });
    }

    return exact;
  }

  private async fetchJson(url: string): Promise<KitsuResponse> {
    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.api+json",
        "user-agent": "MikaCLI/1.0 (+https://kitsu.io)",
      },
    });

    if (!response.ok) {
      throw new MikaCliError("KITSU_REQUEST_FAILED", "Kitsu request failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url,
        },
      });
    }

    return (await response.json()) as KitsuResponse;
  }

  private toSummary(resource: KitsuAnimeResource): KitsuTitleSummary {
    const attributes = resource.attributes;
    const slug = attributes.slug ?? resource.id;
    return {
      id: resource.id,
      title: pickKitsuTitle(attributes),
      year: parseYear(attributes.startDate),
      type: attributes.subtype ?? undefined,
      score: attributes.averageRating ?? undefined,
      status: attributes.status ?? undefined,
      episodes: attributes.episodeCount ?? undefined,
      summary: trimSummary(attributes.synopsis?.trim() ?? ""),
      imageUrl: attributes.posterImage?.original ?? attributes.posterImage?.large ?? attributes.posterImage?.small ?? undefined,
      url: `https://kitsu.io/anime/${slug}`,
    };
  }

  private toTitle(resource: KitsuAnimeResource): KitsuTitleDetails {
    const summary = this.toSummary(resource);
    const attributes = resource.attributes;
    return {
      ...summary,
      summary: trimSummary(attributes.synopsis?.trim() ?? "", 500),
      altTitles: collectAltTitles(attributes),
    };
  }
}

function asArray(value: KitsuResponse["data"]): KitsuAnimeResource[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function pickKitsuTitle(attributes: KitsuAnimeAttributes): string {
  return (
    attributes.canonicalTitle?.trim() ||
    attributes.titles?.en_jp?.trim() ||
    attributes.titles?.en?.trim() ||
    attributes.titles?.ja_jp?.trim() ||
    attributes.slug?.replace(/-/g, " ") ||
    "Untitled"
  );
}

function collectAltTitles(attributes: KitsuAnimeAttributes): string[] | undefined {
  const values = new Set<string>();
  for (const value of Object.values(attributes.titles ?? {})) {
    if (value?.trim()) {
      values.add(value.trim());
    }
  }
  for (const value of attributes.abbreviatedTitles ?? []) {
    if (value?.trim()) {
      values.add(value.trim());
    }
  }
  const titles = [...values].filter((value) => value !== attributes.canonicalTitle);
  return titles.length > 0 ? titles : undefined;
}

function parseYear(value: string | undefined): number | undefined {
  const year = Number.parseInt(value?.slice(0, 4) ?? "", 10);
  return Number.isFinite(year) ? year : undefined;
}

function extractKitsuId(value: string): string | undefined {
  const match = value.match(/kitsu\.io\/anime\/(\d+)/) ?? value.match(/^\d+$/);
  return match?.[1] ?? match?.[0];
}

function extractKitsuSlug(value: string): string | undefined {
  const match = value.match(/kitsu\.io\/anime\/([^/?#]+)/);
  const slug = match?.[1];
  return slug && !/^\d+$/.test(slug) ? slug : undefined;
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

export const kitsuAdapter = new KitsuAdapter();
