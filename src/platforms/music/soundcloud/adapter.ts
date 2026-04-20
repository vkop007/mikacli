import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { ensureParentDirectory, getCachePath } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";
import {
  extractSoundCloudNumericId,
  formatCompactNumber,
  formatMilliseconds,
  isSoundCloudPlaylistKind,
  normalizeSoundCloudLimit,
  normalizeSoundCloudUrl,
  pickAudioExtension,
  slugifyFilename,
  trimPreview,
} from "./helpers.js";

import type { AdapterActionResult } from "../../../types.js";
import type { SoundCloudSearchType } from "./helpers.js";

interface SoundCloudApiSearchResponse<T> {
  collection?: T[];
}

interface SoundCloudApiClientHydrationEntry {
  hydratable?: string;
  data?: {
    id?: string;
  };
}

interface SoundCloudUser {
  kind: "user";
  id: number;
  username?: string;
  full_name?: string | null;
  permalink_url?: string;
  description?: string | null;
  followers_count?: number;
  playlist_count?: number;
  track_count?: number;
  city?: string | null;
  country_code?: string | null;
}

interface SoundCloudTranscoding {
  url: string;
  format?: {
    protocol?: string;
    mime_type?: string;
  };
  snipped?: boolean;
}

interface SoundCloudTrack {
  kind: "track";
  id: number;
  title: string;
  permalink_url?: string;
  description?: string | null;
  duration?: number;
  full_duration?: number;
  genre?: string | null;
  playback_count?: number;
  likes_count?: number;
  comment_count?: number;
  reposts_count?: number;
  streamable?: boolean;
  downloadable?: boolean;
  user?: SoundCloudUser;
  publisher_metadata?: {
    artist?: string | null;
  } | null;
  media?: {
    transcodings?: SoundCloudTranscoding[];
  } | null;
}

interface SoundCloudPlaylist {
  kind: "playlist" | "system-playlist";
  id: number;
  title: string;
  permalink_url?: string;
  description?: string | null;
  duration?: number;
  track_count?: number;
  tracks?: SoundCloudTrack[];
  user?: SoundCloudUser;
}

type SoundCloudResolveResult = SoundCloudTrack | SoundCloudPlaylist | SoundCloudUser;

const SOUNDCLOUD_HOME_URL = "https://soundcloud.com/search/sounds?q=dandelions";
const SOUNDCLOUD_API_ORIGIN = "https://api-v2.soundcloud.com";
const SOUNDCLOUD_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const SOUNDCLOUD_CLIENT_ID_TTL_MS = 30 * 60 * 1000;
const FFMPEG_BIN = process.env.MIKACLI_FFMPEG_BIN || "ffmpeg";

export class SoundCloudAdapter {
  readonly platform = "soundcloud" as const;
  readonly displayName = "SoundCloud";

  private clientIdCache?: {
    value: string;
    fetchedAt: number;
  };

  async search(input: { query: string; type?: SoundCloudSearchType; limit?: number }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("SOUNDCLOUD_QUERY_REQUIRED", "Provide a SoundCloud query to search.");
    }

    const limit = normalizeSoundCloudLimit(input.limit, 5, 25);
    const type = input.type ?? "track";
    const results =
      type === "all"
        ? await this.searchAll(query, limit)
        : await this.searchSingleType(query, type, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} SoundCloud result${results.length === 1 ? "" : "s"}.`,
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
      message: `Loaded SoundCloud track ${track.title}.`,
      id: String(track.id),
      url: track.permalink_url,
      data: {
        title: track.title,
        artist: pickTrackArtist(track),
        duration: formatMilliseconds(track.full_duration ?? track.duration),
        genre: track.genre ?? undefined,
        plays: formatMetric(track.playback_count, "plays"),
        likes: formatMetric(track.likes_count, "likes"),
        comments: formatMetric(track.comment_count, "comments"),
        reposts: formatMetric(track.reposts_count, "reposts"),
        description: trimPreview(track.description, 500),
      },
    };
  }

  async playlistInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const playlist = await this.resolvePlaylist(input.target);
    const limit = normalizeSoundCloudLimit(input.limit, 10, 50);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "playlist",
      message: `Loaded SoundCloud playlist ${playlist.title}.`,
      id: String(playlist.id),
      url: playlist.permalink_url,
      data: {
        title: playlist.title,
        owner: playlist.user?.username ?? playlist.user?.full_name ?? undefined,
        totalTracks: describeCount(playlist.track_count ?? playlist.tracks?.length, "track"),
        duration: formatMilliseconds(playlist.duration),
        description: trimPreview(playlist.description, 500),
        tracks: (playlist.tracks ?? []).slice(0, limit).map((track) => this.toTrackListItem(track)),
      },
    };
  }

  async userInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const user = await this.resolveUser(input.target);
    const limit = normalizeSoundCloudLimit(input.limit, 10, 25);
    const tracksResponse = await this.requestApi<SoundCloudApiSearchResponse<SoundCloudTrack>>(`/users/${user.id}/tracks`, {
      limit,
      linked_partitioning: 1,
    });

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "user",
      message: `Loaded SoundCloud user ${user.username ?? user.full_name ?? user.id}.`,
      id: String(user.id),
      url: user.permalink_url,
      data: {
        title: user.username ?? user.full_name ?? "Unknown user",
        fullName: user.full_name ?? undefined,
        location: [user.city, user.country_code].filter((value): value is string => Boolean(value && value.length > 0)).join(", ") || undefined,
        followers: formatMetric(user.followers_count, "followers"),
        trackCount: describeCount(user.track_count, "track"),
        playlistCount: describeCount(user.playlist_count, "playlist"),
        description: trimPreview(user.description, 500),
        topTracks: (tracksResponse.collection ?? []).map((track) => this.toTrackListItem(track)),
      },
    };
  }

  async related(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const track = await this.resolveTrack(input.target);
    const limit = normalizeSoundCloudLimit(input.limit, 5, 25);
    const response = await this.requestApi<SoundCloudApiSearchResponse<SoundCloudTrack>>(`/tracks/${track.id}/related`, {
      limit,
      linked_partitioning: 1,
    });

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "related",
      message: `Loaded ${response.collection?.length ?? 0} related SoundCloud track${response.collection?.length === 1 ? "" : "s"}.`,
      id: String(track.id),
      url: track.permalink_url,
      data: {
        source: track.title,
        results: (response.collection ?? []).map((item) => this.toSearchResult(item)),
      },
    };
  }

  async download(input: { target: string; output?: string; outputDir?: string }): Promise<AdapterActionResult> {
    const track = await this.resolveTrack(input.target);
    const stream = await this.resolveDownloadStream(track);
    const outputPath = resolveDownloadOutputPath({
      title: track.title,
      id: track.id,
      output: input.output,
      outputDir: input.outputDir,
      extension: pickAudioExtension(stream.mimeType, stream.protocol),
    });

    await ensureParentDirectory(outputPath);
    if (stream.protocol === "progressive") {
      await this.downloadFile(stream.url, outputPath);
    } else {
      await this.downloadWithFfmpeg(stream.url, outputPath);
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "download",
      message: `Saved SoundCloud track ${track.title}.`,
      id: String(track.id),
      url: track.permalink_url,
      data: {
        title: track.title,
        outputPath,
        protocol: stream.protocol,
        mimeType: stream.mimeType,
      },
    };
  }

  private async searchAll(query: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const perTypeLimit = Math.max(1, Math.ceil(limit / 3));
    const [tracks, playlists, users] = await Promise.all([
      this.searchTracks(query, perTypeLimit),
      this.searchPlaylists(query, perTypeLimit),
      this.searchUsers(query, perTypeLimit),
    ]);

    return [...tracks.map((item) => this.toSearchResult(item)), ...playlists.map((item) => this.toSearchResult(item)), ...users.map((item) => this.toSearchResult(item))].slice(
      0,
      limit,
    );
  }

  private async searchSingleType(query: string, type: Exclude<SoundCloudSearchType, "all">, limit: number): Promise<Array<Record<string, unknown>>> {
    switch (type) {
      case "track":
        return (await this.searchTracks(query, limit)).map((item) => this.toSearchResult(item));
      case "playlist":
        return (await this.searchPlaylists(query, limit)).map((item) => this.toSearchResult(item));
      case "user":
        return (await this.searchUsers(query, limit)).map((item) => this.toSearchResult(item));
    }
  }

  private async searchTracks(query: string, limit: number): Promise<SoundCloudTrack[]> {
    const response = await this.requestApi<SoundCloudApiSearchResponse<SoundCloudTrack>>("/search/tracks", {
      q: query,
      limit,
      linked_partitioning: 1,
    });
    return response.collection ?? [];
  }

  private async searchPlaylists(query: string, limit: number): Promise<SoundCloudPlaylist[]> {
    const response = await this.requestApi<SoundCloudApiSearchResponse<SoundCloudPlaylist>>("/search/playlists", {
      q: query,
      limit,
      linked_partitioning: 1,
    });
    return response.collection ?? [];
  }

  private async searchUsers(query: string, limit: number): Promise<SoundCloudUser[]> {
    const response = await this.requestApi<SoundCloudApiSearchResponse<SoundCloudUser>>("/search/users", {
      q: query,
      limit,
      linked_partitioning: 1,
    });
    return response.collection ?? [];
  }

  private async resolveTrack(target: string): Promise<SoundCloudTrack> {
    const resolved = await this.resolveEntity(target, "track");
    if (!isTrack(resolved)) {
      throw new MikaCliError("SOUNDCLOUD_TRACK_NOT_FOUND", "SoundCloud could not resolve that track.", {
        details: {
          target,
          kind: resolved.kind,
        },
      });
    }
    return this.fetchTrack(resolved.id);
  }

  private async resolvePlaylist(target: string): Promise<SoundCloudPlaylist> {
    const resolved = await this.resolveEntity(target, "playlist");
    if (!isSoundCloudPlaylist(resolved)) {
      throw new MikaCliError("SOUNDCLOUD_PLAYLIST_NOT_FOUND", "SoundCloud could not resolve that playlist.", {
        details: {
          target,
          kind: resolved.kind,
        },
      });
    }
    return this.fetchPlaylist(resolved.id);
  }

  private async resolveUser(target: string): Promise<SoundCloudUser> {
    const resolved = await this.resolveEntity(target, "user");
    if (!isUser(resolved)) {
      throw new MikaCliError("SOUNDCLOUD_USER_NOT_FOUND", "SoundCloud could not resolve that user.", {
        details: {
          target,
          kind: resolved.kind,
        },
      });
    }
    return this.fetchUser(resolved.id);
  }

  private async resolveEntity(target: string, kind: "track" | "playlist" | "user"): Promise<SoundCloudResolveResult> {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) {
      throw new MikaCliError("SOUNDCLOUD_TARGET_REQUIRED", "Provide a SoundCloud URL, numeric ID, or search query.");
    }

    const url = normalizeSoundCloudUrl(normalizedTarget);
    if (url) {
      return this.requestApi<SoundCloudResolveResult>("/resolve", { url });
    }

    const id = extractSoundCloudNumericId(normalizedTarget);
    if (id) {
      switch (kind) {
        case "track":
          return this.fetchTrack(id);
        case "playlist":
          return this.fetchPlaylist(id);
        case "user":
          return this.fetchUser(id);
      }
    }

    switch (kind) {
      case "track":
        return this.pickSearchHit(await this.searchTracks(normalizedTarget, 5), normalizedTarget, "SOUNDCLOUD_TRACK_NOT_FOUND");
      case "playlist":
        return this.pickSearchHit(await this.searchPlaylists(normalizedTarget, 5), normalizedTarget, "SOUNDCLOUD_PLAYLIST_NOT_FOUND");
      case "user":
        return this.pickSearchHit(await this.searchUsers(normalizedTarget, 5), normalizedTarget, "SOUNDCLOUD_USER_NOT_FOUND");
    }
  }

  private pickSearchHit<T extends SoundCloudTrack | SoundCloudPlaylist | SoundCloudUser>(collection: T[], target: string, code: string): T {
    const normalized = target.trim().toLowerCase();
    const exact =
      collection.find((item) => {
        if (isUser(item)) {
          return item.username?.trim().toLowerCase() === normalized || item.full_name?.trim().toLowerCase() === normalized;
        }

        return item.title?.trim().toLowerCase() === normalized;
      }) ?? collection[0];

    if (!exact) {
      throw new MikaCliError(code, "SoundCloud could not find a matching result.", {
        details: {
          target,
        },
      });
    }

    return exact;
  }

  private async fetchTrack(id: number): Promise<SoundCloudTrack> {
    return this.requestApi<SoundCloudTrack>(`/tracks/${id}`);
  }

  private async fetchPlaylist(id: number): Promise<SoundCloudPlaylist> {
    return this.requestApi<SoundCloudPlaylist>(`/playlists/${id}`, {
      representation: "full",
    });
  }

  private async fetchUser(id: number): Promise<SoundCloudUser> {
    return this.requestApi<SoundCloudUser>(`/users/${id}`);
  }

  private async resolveDownloadStream(track: SoundCloudTrack): Promise<{
    url: string;
    protocol: string;
    mimeType: string;
  }> {
    const transcodings = (track.media?.transcodings ?? []).filter((item) => item.snipped !== true);
    const preferred =
      transcodings.find((item) => item.format?.protocol === "progressive") ??
      transcodings.find((item) => item.format?.protocol === "hls") ??
      transcodings[0];

    if (!preferred?.url) {
      throw new MikaCliError("SOUNDCLOUD_STREAM_NOT_AVAILABLE", "SoundCloud did not expose a downloadable stream for this track.", {
        details: {
          trackId: track.id,
        },
      });
    }

    const response = await this.requestAbsolute<{ url?: string }>(preferred.url);
    if (!response.url) {
      throw new MikaCliError("SOUNDCLOUD_STREAM_NOT_AVAILABLE", "SoundCloud did not return a media URL for this track.", {
        details: {
          trackId: track.id,
          transcodingUrl: preferred.url,
        },
      });
    }

    return {
      url: response.url,
      protocol: preferred.format?.protocol ?? "unknown",
      mimeType: preferred.format?.mime_type ?? "audio/mpeg",
    };
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url, {
      headers: {
        "user-agent": SOUNDCLOUD_USER_AGENT,
        accept: "*/*",
      },
    });

    if (!response.ok || !response.body) {
      throw new MikaCliError("SOUNDCLOUD_DOWNLOAD_FAILED", "SoundCloud media download failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url,
        },
      });
    }

    const stream = Readable.fromWeb(response.body as any);
    await pipeline(stream, createWriteStream(outputPath));
  }

  private async downloadWithFfmpeg(url: string, outputPath: string): Promise<void> {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn(
        FFMPEG_BIN,
        ["-y", "-hide_banner", "-loglevel", "error", "-i", url, "-vn", "-c", "copy", outputPath],
        {
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => {
        rejectPromise(
          new MikaCliError("SOUNDCLOUD_FFMPEG_NOT_AVAILABLE", "ffmpeg is required to download non-progressive SoundCloud streams.", {
            details: {
              command: FFMPEG_BIN,
            },
            cause: error,
          }),
        );
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolvePromise();
          return;
        }

        rejectPromise(
          new MikaCliError("SOUNDCLOUD_DOWNLOAD_FAILED", `ffmpeg exited with code ${code} while saving the SoundCloud track.`, {
            details: {
              outputPath,
              stderr: stderr.trim() || null,
            },
          }),
        );
      });
    });
  }

  private async requestApi<T>(path: string, query: Record<string, string | number | boolean | undefined> = {}, retry = true): Promise<T> {
    const clientId = await this.getClientId();
    const url = new URL(`${SOUNDCLOUD_API_ORIGIN}${path}`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("app_locale", "en");

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: {
        "user-agent": SOUNDCLOUD_USER_AGENT,
        accept: "application/json, text/plain, */*",
      },
    });

    if ((response.status === 401 || response.status === 403) && retry) {
      this.clientIdCache = undefined;
      return this.requestApi<T>(path, query, false);
    }

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new MikaCliError("SOUNDCLOUD_REQUEST_FAILED", "SoundCloud request failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url: url.toString(),
          body,
        },
      });
    }

    return (await response.json()) as T;
  }

  private async requestAbsolute<T>(absoluteUrl: string, retry = true): Promise<T> {
    const clientId = await this.getClientId();
    const url = new URL(absoluteUrl);
    url.searchParams.set("client_id", clientId);

    const response = await fetch(url, {
      headers: {
        "user-agent": SOUNDCLOUD_USER_AGENT,
        accept: "application/json, text/plain, */*",
      },
    });

    if ((response.status === 401 || response.status === 403) && retry) {
      this.clientIdCache = undefined;
      return this.requestAbsolute<T>(absoluteUrl, false);
    }

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new MikaCliError("SOUNDCLOUD_REQUEST_FAILED", "SoundCloud request failed.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url: url.toString(),
          body,
        },
      });
    }

    return (await response.json()) as T;
  }

  private async getClientId(): Promise<string> {
    const cached = this.clientIdCache;
    if (cached && Date.now() - cached.fetchedAt < SOUNDCLOUD_CLIENT_ID_TTL_MS) {
      return cached.value;
    }

    const response = await fetch(SOUNDCLOUD_HOME_URL, {
      headers: {
        "user-agent": SOUNDCLOUD_USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new MikaCliError("SOUNDCLOUD_CLIENT_ID_FETCH_FAILED", "Failed to load SoundCloud's public web app.", {
        details: {
          status: response.status,
          statusText: response.statusText,
          url: SOUNDCLOUD_HOME_URL,
        },
      });
    }

    const html = await response.text();
    const marker = "window.__sc_hydration = ";
    const start = html.indexOf(marker);
    const end = html.indexOf(";</script>", start);
    if (start < 0 || end < 0) {
      throw new MikaCliError("SOUNDCLOUD_CLIENT_ID_MISSING", "Could not locate SoundCloud hydration data for the current web app.");
    }

    let hydration: SoundCloudApiClientHydrationEntry[];
    try {
      hydration = JSON.parse(html.slice(start + marker.length, end)) as SoundCloudApiClientHydrationEntry[];
    } catch (error) {
      throw new MikaCliError("SOUNDCLOUD_CLIENT_ID_INVALID", "Could not parse SoundCloud hydration data.", {
        cause: error,
      });
    }

    const clientId = hydration.find((entry) => entry.hydratable === "apiClient")?.data?.id;
    if (!clientId) {
      throw new MikaCliError("SOUNDCLOUD_CLIENT_ID_MISSING", "Could not find SoundCloud's current public client id.");
    }

    this.clientIdCache = {
      value: clientId,
      fetchedAt: Date.now(),
    };

    return clientId;
  }

  private toSearchResult(item: SoundCloudTrack | SoundCloudPlaylist | SoundCloudUser): Record<string, unknown> {
    if (isTrack(item)) {
      return this.toTrackListItem(item);
    }

    if (isSoundCloudPlaylist(item)) {
      return {
        type: "playlist",
        id: String(item.id),
        title: item.title,
        subtitle: item.user?.username ?? item.user?.full_name ?? undefined,
        detail: [describeCount(item.track_count ?? item.tracks?.length, "track"), formatMilliseconds(item.duration)].filter(Boolean).join(" • "),
        url: item.permalink_url,
      };
    }

    return {
      type: "user",
      id: String(item.id),
      title: item.username ?? "Unknown user",
      subtitle: item.full_name ?? undefined,
      detail: [formatMetric(item.followers_count, "followers"), describeCount(item.track_count, "track")].filter(Boolean).join(" • "),
      url: item.permalink_url,
    };
  }

  private toTrackListItem(track: SoundCloudTrack): Record<string, unknown> {
    return {
      type: "track",
      id: String(track.id),
      title: track.title,
      subtitle: pickTrackArtist(track),
      detail: [formatMilliseconds(track.full_duration ?? track.duration), formatMetric(track.playback_count, "plays")].filter(Boolean).join(" • "),
      url: track.permalink_url,
    };
  }
}

async function safeReadText(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.length > 400 ? `${text.slice(0, 400)}...` : text;
  } catch {
    return undefined;
  }
}

function pickTrackArtist(track: SoundCloudTrack): string | undefined {
  return track.publisher_metadata?.artist ?? track.user?.username ?? track.user?.full_name ?? undefined;
}

function describeCount(value: number | undefined, label: string): string | undefined {
  if (!Number.isFinite(value) || value === undefined) {
    return undefined;
  }

  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

function formatMetric(value: number | undefined, label: string): string | undefined {
  const compact = formatCompactNumber(value);
  return compact ? `${compact} ${label}` : undefined;
}

function isTrack(value: SoundCloudResolveResult): value is SoundCloudTrack {
  return value.kind === "track";
}

function isSoundCloudPlaylist(value: SoundCloudResolveResult): value is SoundCloudPlaylist {
  return isSoundCloudPlaylistKind(value.kind);
}

function isUser(value: SoundCloudResolveResult): value is SoundCloudUser {
  return value.kind === "user";
}

function resolveDownloadOutputPath(input: {
  title: string;
  id: number;
  output?: string;
  outputDir?: string;
  extension: string;
}): string {
  if (input.output && input.outputDir) {
    throw new MikaCliError("SOUNDCLOUD_DOWNLOAD_PATH_CONFLICT", "Use either --output or --output-dir, not both.");
  }

  const filename = `${slugifyFilename(`${input.title}-${input.id}`)}${input.extension}`;

  if (input.output) {
    const resolved = resolve(input.output);
    return extname(resolved) ? resolved : `${resolved}${input.extension}`;
  }

  if (input.outputDir) {
    return join(resolve(input.outputDir), filename);
  }

  return getCachePath("soundcloud", "downloads", filename);
}

export const soundCloudAdapter = new SoundCloudAdapter();
