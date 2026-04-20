import { MikaCliError } from "../../../errors.js";
import { WebSearchClient } from "../../tools/websearch/client.js";
import {
  buildDeezerEntityUrl,
  formatCompactNumber,
  formatDuration,
  normalizeDeezerLimit,
  parseDeezerEntityTarget,
  trimPreview,
  toTrackSubtitle,
  type DeezerEntityKind,
  type DeezerSearchType,
} from "./helpers.js";

import type { AdapterActionResult } from "../../../types.js";

type DeezerSearchResponse<T> = {
  data?: T[];
  total?: number;
};

type DeezerArtist = {
  id: number;
  name: string;
  link?: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_fan?: number;
  nb_album?: number;
  tracklist?: string;
  share?: string;
};

type DeezerAlbum = {
  id: number;
  title: string;
  link?: string;
  share?: string;
  cover?: string;
  cover_small?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  nb_tracks?: number;
  fans?: number;
  release_date?: string;
  record_type?: string;
  label?: string;
  duration?: number;
  tracks?: DeezerSearchResponse<DeezerTrack>;
  artist?: DeezerArtist;
};

type DeezerTrack = {
  id: number;
  title: string;
  title_short?: string;
  link?: string;
  share?: string;
  duration?: number;
  preview?: string;
  rank?: number;
  explicit_lyrics?: boolean;
  preview_duration?: number;
  artist?: DeezerArtist;
  album?: DeezerAlbum;
};

type DeezerPlaylist = {
  id: number;
  title: string;
  link?: string;
  share?: string;
  description?: string;
  duration?: number;
  fans?: number;
  nb_tracks?: number;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  creator?: DeezerArtist;
  tracks?: DeezerSearchResponse<DeezerTrack>;
};

type DeezerSearchResult = {
  id: number;
  kind: DeezerEntityKind;
  title: string;
  subtitle?: string;
  detail?: string;
  url: string;
};

const DEEZER_API_ORIGIN = "https://api.deezer.com";
const DEEZER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const webSearchClient = new WebSearchClient();

export class DeezerAdapter {
  readonly platform = "deezer" as const;
  readonly displayName = "Deezer";

  async search(input: { query: string; type?: DeezerSearchType; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("DEEZER_QUERY_REQUIRED", "Provide a Deezer query to search.");
    }

    const type = input.type ?? "all";
    const limit = normalizeDeezerLimit(input.limit, 5, 25);
    const results =
      type === "all"
        ? await this.searchAll(query, limit)
        : await this.searchTyped(query, type, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} Deezer result${results.length === 1 ? "" : "s"}.`,
      data: {
        query,
        type,
        results,
      },
    };
  }

  async trackInfo(input: { target: string }): Promise<AdapterActionResult> {
    const track = await this.resolveTrack(input.target);
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "track",
      message: `Loaded Deezer track ${track.title}.`,
      id: String(track.id),
      url: track.link ?? buildDeezerEntityUrl("track", track.id, track.title),
      data: {
        title: track.title,
        artist: track.artist?.name,
        album: track.album?.title,
        duration: formatDuration(track.duration),
        plays: formatCompactNumber(track.rank),
        explicit: track.explicit_lyrics ?? undefined,
        previewUrl: track.preview,
        label: track.album?.label,
        releaseDate: track.album?.release_date,
        summary: trimPreview(track.album?.title ? `${track.artist?.name ?? ""} • ${track.album.title}` : track.artist?.name),
      },
    };
  }

  async albumInfo(input: { target: string }): Promise<AdapterActionResult> {
    const album = await this.resolveAlbum(input.target);
    const tracks = (album.tracks?.data ?? []).map((track) => this.toTrackListItem(track));
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "album",
      message: `Loaded Deezer album ${album.title}.`,
      id: String(album.id),
      url: album.link ?? buildDeezerEntityUrl("album", album.id, album.title),
      data: {
        title: album.title,
        artist: album.artist?.name,
        label: album.label,
        recordType: album.record_type,
        releaseDate: album.release_date,
        fans: formatCompactNumber(album.fans),
        tracks: formatCompactNumber(album.nb_tracks),
        duration: formatDuration(album.duration),
        coverUrl: album.cover_xl ?? album.cover_big ?? album.cover_medium ?? album.cover,
        description: trimPreview(`${album.artist?.name ?? ""}${album.release_date ? ` • ${album.release_date}` : ""}`),
        items: tracks,
      },
    };
  }

  async artistInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const artist = await this.resolveArtist(input.target);
    const limit = normalizeDeezerLimit(input.limit, 10, 50);
    const [topTracks, albums] = await Promise.all([
      this.requestJson<DeezerSearchResponse<DeezerTrack>>(`/artist/${artist.id}/top`, { limit }),
      this.requestJson<DeezerSearchResponse<DeezerAlbum>>(`/artist/${artist.id}/albums`, { limit }),
    ]);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "artist",
      message: `Loaded Deezer artist ${artist.name}.`,
      id: String(artist.id),
      url: artist.link ?? buildDeezerEntityUrl("artist", artist.id, artist.name),
      data: {
        title: artist.name,
        fans: formatCompactNumber(artist.nb_fan),
        albums: formatCompactNumber(artist.nb_album),
        pictureUrl: artist.picture_xl ?? artist.picture_big ?? artist.picture_medium ?? artist.picture_small ?? artist.picture,
        summary: trimPreview(artist.share ?? artist.link),
        topTracks: (topTracks.data ?? []).map((track) => this.toTrackListItem(track)),
        releases: (albums.data ?? []).map((release) => ({
          title: release.title,
          detail: [
            release.release_date,
            release.record_type,
            formatCompactNumber(release.nb_tracks) ? `${formatCompactNumber(release.nb_tracks)} tracks` : undefined,
          ]
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .join(" • "),
          url: release.link ?? buildDeezerEntityUrl("album", release.id, release.title),
        })),
      },
    };
  }

  async playlistInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const playlist = await this.resolvePlaylist(input.target);
    const limit = normalizeDeezerLimit(input.limit, 10, 50);
    const tracks = (playlist.tracks?.data ?? []).slice(0, limit).map((track) => this.toTrackListItem(track));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "playlist",
      message: `Loaded Deezer playlist ${playlist.title}.`,
      id: String(playlist.id),
      url: playlist.link ?? buildDeezerEntityUrl("playlist", playlist.id, playlist.title),
      data: {
        title: playlist.title,
        owner: playlist.creator?.name,
        description: trimPreview(playlist.description, 500),
        tracks: formatCompactNumber(playlist.nb_tracks),
        duration: formatDuration(playlist.duration),
        fans: formatCompactNumber(playlist.fans),
        coverUrl: playlist.picture_xl ?? playlist.picture_big ?? playlist.picture_medium ?? playlist.picture_small ?? playlist.picture,
        items: tracks,
      },
    };
  }

  private async searchAll(query: string, limit: number): Promise<DeezerSearchResult[]> {
    const perTypeLimit = Math.max(1, Math.min(25, Math.ceil(limit / 4)));
    const [tracks, albums, artists, playlists] = await Promise.all([
      this.searchTyped(query, "track", perTypeLimit),
      this.searchTyped(query, "album", perTypeLimit),
      this.searchTyped(query, "artist", perTypeLimit),
      this.searchTyped(query, "playlist", perTypeLimit),
    ]);

    return [...tracks, ...albums, ...artists, ...playlists].slice(0, limit);
  }

  private async searchTyped(query: string, type: DeezerSearchType, limit: number): Promise<DeezerSearchResult[]> {
    if (type === "all") {
      return this.searchAll(query, limit);
    }

    const response = await this.requestJson<DeezerSearchResponse<Record<string, unknown>>>(
      `/search/${type}`,
      { q: query, limit },
    );

    const results = (response.data ?? [])
      .map((item) => this.mapSearchResult(item, type))
      .filter((value): value is DeezerSearchResult => Boolean(value))
      .slice(0, limit);

    const relevant = results.filter((result) => matchesQuery(result, query));
    if (relevant.length > 0) {
      return relevant.slice(0, limit);
    }

    return this.searchViaSearchEngine(query, type, limit);
  }

  private async resolveTrack(target: string): Promise<DeezerTrack> {
    return this.resolveEntity<DeezerTrack>("track", target);
  }

  private async resolveAlbum(target: string): Promise<DeezerAlbum> {
    return this.resolveEntity<DeezerAlbum>("album", target);
  }

  private async resolveArtist(target: string): Promise<DeezerArtist> {
    return this.resolveEntity<DeezerArtist>("artist", target);
  }

  private async resolvePlaylist(target: string): Promise<DeezerPlaylist> {
    return this.resolveEntity<DeezerPlaylist>("playlist", target);
  }

  private async resolveEntity<T extends { id: number; title?: string; name?: string }>(kind: DeezerEntityKind, target: string): Promise<T> {
    const numericId = extractNumericId(target);
    if (numericId !== undefined) {
      return this.requestJson<T>(`/${kind}/${numericId}`);
    }

    const parsed = parseDeezerEntityTarget(target);
    if (parsed?.kind === kind) {
      return this.requestJson<T>(`/${kind}/${parsed.id}`);
    }

    if (parsed && parsed.kind !== kind) {
      throw new MikaCliError("DEEZER_TARGET_TYPE_MISMATCH", `The target is a Deezer ${parsed.kind}, not a ${kind}.`, {
        details: {
          target,
          expected: kind,
          actual: parsed.kind,
        },
      });
    }

    const matches = await this.searchTyped(target, kind, 1);
    const match = matches[0];
    if (!match) {
      throw new MikaCliError("DEEZER_RESULT_NOT_FOUND", `Deezer could not find a matching ${kind}.`, {
        details: {
          target,
          kind,
        },
      });
    }

    return this.requestJson<T>(`/${kind}/${match.id}`);
  }

  private async searchViaSearchEngine(query: string, type: DeezerEntityKind, limit: number): Promise<DeezerSearchResult[]> {
    for (const engine of ["brave", "yahoo", "duckduckgo"] as const) {
      let results: Awaited<ReturnType<WebSearchClient["search"]>>;
      try {
        results = await webSearchClient.search({
          engine,
          query: `site:deezer.com/${type} ${query}`,
          limit: Math.max(limit * 4, 10),
          summary: false,
        });
      } catch {
        continue;
      }

      const matches = dedupeCandidates(
        results.results
          .map((result) => parseDeezerEntityTarget(result.url))
          .filter((value): value is { kind: DeezerEntityKind; id: number; url?: string } => Boolean(value && value.kind === type)),
      ).slice(0, limit);

      const loaded = await Promise.all(
        matches.map(async (candidate) => {
          try {
            return await this.loadSearchEntity(type, candidate.id);
          } catch {
            return undefined;
          }
        }),
      );

      const resolved = loaded.filter((value): value is DeezerSearchResult => Boolean(value)).filter((value) => matchesQuery(value, query)).slice(0, limit);
      if (resolved.length > 0) {
        return resolved;
      }
    }

    return [];
  }

  private async loadSearchEntity(kind: DeezerEntityKind, id: number): Promise<DeezerSearchResult | undefined> {
    if (kind === "track") {
      const track = await this.requestJson<DeezerTrack>(`/track/${id}`);
      return this.toTrackSearchResult(track);
    }
    if (kind === "album") {
      const album = await this.requestJson<DeezerAlbum>(`/album/${id}`);
      return this.toAlbumSearchResult(album);
    }
    if (kind === "artist") {
      const artist = await this.requestJson<DeezerArtist>(`/artist/${id}`);
      return this.toArtistSearchResult(artist);
    }

    const playlist = await this.requestJson<DeezerPlaylist>(`/playlist/${id}`);
    return this.toPlaylistSearchResult(playlist);
  }

  private async requestJson<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${DEEZER_API_ORIGIN}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": DEEZER_USER_AGENT,
        },
      });
    } catch (error) {
      throw new MikaCliError("DEEZER_REQUEST_FAILED", "Failed to reach Deezer.", {
        cause: error,
        details: {
          url: url.toString(),
        },
      });
    }

    const text = await response.text();
    if (!response.ok) {
      throw new MikaCliError("DEEZER_REQUEST_FAILED", `Deezer request failed with ${response.status} ${response.statusText}.`, {
        details: {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, 500),
        },
      });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new MikaCliError("DEEZER_RESPONSE_INVALID", "Deezer returned invalid JSON.", {
        cause: error,
        details: {
          url: url.toString(),
          body: text.slice(0, 500),
        },
      });
    }

    const record = payload as Record<string, unknown>;
    if (record.error) {
      throw new MikaCliError("DEEZER_REQUEST_FAILED", "Deezer returned an error payload.", {
        details: {
          url: url.toString(),
          error: record.error,
        },
      });
    }

    return payload as T;
  }

  private mapSearchResult(item: Record<string, unknown>, kind: DeezerEntityKind): DeezerSearchResult | undefined {
    const id = asNumber(item.id);
    const title = asString(item.title ?? item.name);
    const link = asString(item.link);
    if (id === undefined || !title) {
      return undefined;
    }

    const artist = asRecord(item.artist);
    const album = asRecord(item.album);
    const subtitle =
      kind === "track"
        ? [asString(artist.name), asString(album.title)].filter((value): value is string => typeof value === "string" && value.length > 0).join(" • ") || undefined
        : kind === "album"
          ? [asString(artist.name), asString(item.release_date)].filter((value): value is string => typeof value === "string" && value.length > 0).join(" • ") || undefined
          : kind === "artist"
            ? [formatCompactNumber(asNumber(item.nb_fan)), formatCompactNumber(asNumber(item.nb_album))]
                .filter((value): value is string => typeof value === "string" && value.length > 0)
                .join(" • ") || undefined
            : kind === "playlist"
              ? [formatCompactNumber(asNumber(item.nb_tracks)), formatCompactNumber(asNumber(item.fans))]
                  .filter((value): value is string => typeof value === "string" && value.length > 0)
                  .join(" • ") || undefined
              : undefined;
    const detail =
      kind === "track"
        ? trimPreview(asString(item.preview) ?? asString(item.record_type) ?? asString(item.release_date))
        : kind === "album"
          ? trimPreview(asString(item.release_date) ?? asString(item.record_type) ?? asString(item.label))
          : kind === "artist"
            ? trimPreview(asString(item.share) ?? asString(item.tracklist))
            : trimPreview(asString(item.description));

    return {
      id,
      kind,
      title,
      subtitle,
      detail,
      url: link ?? buildDeezerEntityUrl(kind, id, title),
    };
  }

  private toTrackListItem(track: DeezerTrack): Record<string, unknown> {
    return {
      id: track.id,
      title: track.title,
      subtitle: toTrackSubtitle(track),
      detail: [
        formatDuration(track.duration),
        track.explicit_lyrics ? "explicit" : undefined,
      ]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" • "),
      url: track.link ?? buildDeezerEntityUrl("track", track.id, track.title),
    };
  }

  private toTrackSearchResult(track: DeezerTrack): DeezerSearchResult | undefined {
    if (!track.id || !track.title) {
      return undefined;
    }

    return {
      id: track.id,
      kind: "track",
      title: track.title,
      subtitle: toTrackSubtitle(track),
      detail: trimPreview(track.preview ? "30 second preview available" : track.album?.release_date),
      url: track.link ?? buildDeezerEntityUrl("track", track.id, track.title),
    };
  }

  private toAlbumSearchResult(album: DeezerAlbum): DeezerSearchResult | undefined {
    if (!album.id || !album.title) {
      return undefined;
    }

    return {
      id: album.id,
      kind: "album",
      title: album.title,
      subtitle: [album.artist?.name, album.release_date].filter((value): value is string => typeof value === "string" && value.length > 0).join(" • ") || undefined,
      detail: trimPreview([album.record_type, album.label].filter((value): value is string => typeof value === "string" && value.length > 0).join(" • ")),
      url: album.link ?? buildDeezerEntityUrl("album", album.id, album.title),
    };
  }

  private toArtistSearchResult(artist: DeezerArtist): DeezerSearchResult | undefined {
    if (!artist.id || !artist.name) {
      return undefined;
    }

    return {
      id: artist.id,
      kind: "artist",
      title: artist.name,
      subtitle: [formatCompactNumber(artist.nb_fan), formatCompactNumber(artist.nb_album)].filter((value): value is string => typeof value === "string" && value.length > 0).join(" • ") || undefined,
      detail: trimPreview(artist.share ?? artist.tracklist),
      url: artist.link ?? buildDeezerEntityUrl("artist", artist.id, artist.name),
    };
  }

  private toPlaylistSearchResult(playlist: DeezerPlaylist): DeezerSearchResult | undefined {
    if (!playlist.id || !playlist.title) {
      return undefined;
    }

    return {
      id: playlist.id,
      kind: "playlist",
      title: playlist.title,
      subtitle: [formatCompactNumber(playlist.nb_tracks), formatCompactNumber(playlist.fans)]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" • ") || undefined,
      detail: trimPreview(playlist.description),
      url: playlist.link ?? buildDeezerEntityUrl("playlist", playlist.id, playlist.title),
    };
  }
}

export const deezerAdapter = new DeezerAdapter();

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function extractNumericId(value: string): number | undefined {
  return /^\d+$/u.test(value.trim()) ? Number.parseInt(value.trim(), 10) : undefined;
}

function dedupeCandidates(candidates: Array<{ kind: DeezerEntityKind; id: number; url?: string }>): Array<{ kind: DeezerEntityKind; id: number; url?: string }> {
  const seen = new Set<string>();
  const unique: Array<{ kind: DeezerEntityKind; id: number; url?: string }> = [];
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function matchesQuery(result: DeezerSearchResult, query: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
  if (tokens.length === 0) {
    return true;
  }

  const haystack = [result.title, result.subtitle, result.detail].filter(Boolean).join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}
