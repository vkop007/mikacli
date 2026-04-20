import { MikaCliError } from "../../../errors.js";
import { decodeHtml, trimSummary } from "../shared/helpers.js";

import type { AdapterActionResult } from "../../../types.js";

const ANILIST_API_URL = "https://graphql.anilist.co";

interface AniListTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

interface AniListMedia {
  id: number;
  siteUrl?: string | null;
  format?: string | null;
  episodes?: number | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  status?: string | null;
  description?: string | null;
  genres?: string[] | null;
  title: AniListTitle;
  coverImage?: {
    large?: string | null;
  } | null;
  studios?: {
    nodes?: Array<{
      name?: string | null;
    }>;
  } | null;
  recommendations?: {
    nodes?: Array<{
      mediaRecommendation?: AniListMedia | null;
    } | null>;
  } | null;
}

interface AniListTitleSummary {
  id: number;
  title: string;
  year?: number;
  type?: string;
  episodes?: number;
  score?: number;
  popularity?: number;
  status?: string;
  summary?: string;
  imageUrl?: string;
  url: string;
}

interface AniListTitleDetails extends AniListTitleSummary {
  studio?: string;
  genres?: string[];
}

interface AniListGraphqlResponse<T> {
  data?: T;
  errors?: Array<{
    message?: string;
    status?: number;
  }>;
}

export class AniListAdapter {
  readonly platform = "anilist" as const;
  readonly displayName = "AniList";

  async search(input: { query: string; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("ANILIST_QUERY_REQUIRED", "Provide an anime query to search AniList.");
    }

    const perPage = normalizeLimit(input.limit, 5, 10);
    const data = await this.requestGraphql<{ Page: { media: AniListMedia[] } }>(
      `
        query SearchAnime($search: String!, $perPage: Int!) {
          Page(page: 1, perPage: $perPage) {
            media(search: $search, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
              id
              siteUrl
              format
              episodes
              seasonYear
              averageScore
              popularity
              status
              description(asHtml: false)
              title {
                romaji
                english
                native
              }
              coverImage {
                large
              }
            }
          }
        }
      `,
      { search: query, perPage },
    );

    const items = (data.Page.media ?? []).map((item) => this.toSummary(item));
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} AniList result${items.length === 1 ? "" : "s"}.`,
      data: {
        query,
        items,
      },
    };
  }

  async titleInfo(input: { target: string }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("ANILIST_TARGET_REQUIRED", "Provide an AniList anime URL, anime ID, or search query.");
    }

    const media = await this.resolveMedia(target);
    const title = this.toTitle(media);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "title",
      message: `Loaded AniList title ${title.title}.`,
      id: String(media.id),
      url: title.url,
      data: {
        title,
      },
    };
  }

  async trending(input: { limit?: number }): Promise<AdapterActionResult> {
    const perPage = normalizeLimit(input.limit, 10, 25);
    const data = await this.requestGraphql<{ Page: { media: AniListMedia[] } }>(
      `
        query TrendingAnime($perPage: Int!) {
          Page(page: 1, perPage: $perPage) {
            media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
              id
              siteUrl
              format
              episodes
              seasonYear
              averageScore
              popularity
              status
              description(asHtml: false)
              title {
                romaji
                english
                native
              }
              coverImage {
                large
              }
            }
          }
        }
      `,
      { perPage },
    );

    const items = (data.Page.media ?? []).map((item) => this.toSummary(item));
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "trending",
      message: `Loaded ${items.length} trending AniList title${items.length === 1 ? "" : "s"}.`,
      data: {
        items,
      },
    };
  }

  async recommendations(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const target = input.target.trim();
    if (!target) {
      throw new MikaCliError("ANILIST_TARGET_REQUIRED", "Provide an AniList anime URL, anime ID, or query.");
    }

    const id = extractAniListId(target);
    const variables = id ? { id, search: null, perPage: normalizeLimit(input.limit, 5, 15) } : { id: null, search: target, perPage: normalizeLimit(input.limit, 5, 15) };
    const data = await this.requestGraphql<{ Media: AniListMedia | null }>(
      `
        query AnimeRecommendations($id: Int, $search: String, $perPage: Int!) {
          Media(id: $id, search: $search, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
            recommendations(sort: [RATING_DESC], perPage: $perPage) {
              nodes {
                mediaRecommendation {
                  id
                  siteUrl
                  format
                  episodes
                  seasonYear
                  averageScore
                  popularity
                  status
                  description(asHtml: false)
                  title {
                    romaji
                    english
                    native
                  }
                  coverImage {
                    large
                  }
                }
              }
            }
          }
        }
      `,
      variables,
    );

    if (!data.Media) {
      throw new MikaCliError("ANILIST_TITLE_NOT_FOUND", "AniList could not find a matching anime.", {
        details: {
          target,
        },
      });
    }

    const items = (data.Media.recommendations?.nodes ?? [])
      .map((entry) => entry?.mediaRecommendation ?? null)
      .filter((entry): entry is AniListMedia => Boolean(entry))
      .slice(0, normalizeLimit(input.limit, 5, 15))
      .map((item) => this.toSummary(item));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "recommendations",
      message: `Loaded ${items.length} AniList recommendation${items.length === 1 ? "" : "s"} for ${pickAniListTitle(data.Media.title)}.`,
      data: {
        target: pickAniListTitle(data.Media.title),
        items,
      },
    };
  }

  private async resolveMedia(target: string): Promise<AniListMedia> {
    const id = extractAniListId(target);
    const variables = id ? { id } : { search: target };
    const data = await this.requestGraphql<{ Media: AniListMedia | null }>(
      `
        query ResolveAnime($id: Int, $search: String) {
          Media(id: $id, search: $search, type: ANIME) {
            id
            siteUrl
            format
            episodes
            seasonYear
            averageScore
            popularity
            status
            description(asHtml: false)
            genres
            title {
              romaji
              english
              native
            }
            studios(isMain: true) {
              nodes {
                name
              }
            }
            coverImage {
              large
            }
          }
        }
      `,
      variables,
    );

    if (!data.Media) {
      throw new MikaCliError("ANILIST_TITLE_NOT_FOUND", "AniList could not find a matching anime.", {
        details: {
          target,
        },
      });
    }

    return data.Media;
  }

  private async requestGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "MikaCLI/1.0 (+https://anilist.co)",
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = (await response.json()) as AniListGraphqlResponse<T>;
    if (!response.ok || payload.errors?.length) {
      throw new MikaCliError("ANILIST_REQUEST_FAILED", "AniList request failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          errors: payload.errors,
        },
      });
    }

    if (!payload.data) {
      throw new MikaCliError("ANILIST_REQUEST_FAILED", "AniList returned an empty response payload.");
    }

    return payload.data;
  }

  private toSummary(media: AniListMedia): AniListTitleSummary {
    return {
      id: media.id,
      title: pickAniListTitle(media.title),
      year: media.seasonYear ?? undefined,
      type: media.format ?? undefined,
      episodes: media.episodes ?? undefined,
      score: media.averageScore ?? undefined,
      popularity: media.popularity ?? undefined,
      status: media.status ? normalizeStatus(media.status) : undefined,
      summary: trimSummary(decodeHtml(media.description?.trim() ?? "")),
      imageUrl: media.coverImage?.large ?? undefined,
      url: media.siteUrl ?? `https://anilist.co/anime/${media.id}`,
    };
  }

  private toTitle(media: AniListMedia): AniListTitleDetails {
    const studio = media.studios?.nodes?.map((entry) => entry.name).find((value): value is string => Boolean(value));
    return {
      id: media.id,
      title: pickAniListTitle(media.title),
      year: media.seasonYear ?? undefined,
      type: media.format ?? undefined,
      status: media.status ? normalizeStatus(media.status) : undefined,
      score: media.averageScore ?? undefined,
      popularity: media.popularity ?? undefined,
      episodes: media.episodes ?? undefined,
      studio,
      genres: media.genres?.filter(Boolean) ?? undefined,
      summary: trimSummary(decodeHtml(media.description?.trim() ?? ""), 500),
      imageUrl: media.coverImage?.large ?? undefined,
      url: media.siteUrl ?? `https://anilist.co/anime/${media.id}`,
    };
  }
}

function pickAniListTitle(title: AniListTitle): string {
  return title.english?.trim() || title.romaji?.trim() || title.native?.trim() || "Untitled";
}

function normalizeStatus(value: string): string {
  return value.toLowerCase().replace(/_/g, "-");
}

function extractAniListId(value: string): number | undefined {
  const match = value.match(/anilist\.co\/anime\/(\d+)/) ?? value.match(/^\d+$/);
  const parsed = Number.parseInt(match?.[1] ?? match?.[0] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(limit)));
}

export const aniListAdapter = new AniListAdapter();
