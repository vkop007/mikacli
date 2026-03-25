import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import WebSocket, { type RawData } from "ws";

import { ensureParentDirectory, getCachePath } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { formatSpotifyDuration, spotifyUriToUrl } from "./helpers.js";
import {
  SPOTIFY_APP_PLATFORM,
  SPOTIFY_CLIENT_TOKEN_ENDPOINT,
  SPOTIFY_CONNECT_DEVICE_MODEL,
  SPOTIFY_CONNECT_DEVICE_NAME,
  SPOTIFY_CONNECT_STATE_BASE,
  SPOTIFY_CONNECT_VERSION,
  SPOTIFY_DEALER_URL,
  SPOTIFY_PATHFINDER_ENDPOINT,
  SPOTIFY_TRACK_PLAYBACK_BASE,
  SPOTIFY_USER_AGENT,
} from "./constants.js";

import type { SpotifyRepeatState } from "./options.js";
import type { SpotifyEntityType } from "../../../utils/targets.js";

type JsonRecord = Record<string, unknown>;

type SpotifyConnectAuth = {
  accessToken: string;
  clientId: string;
  clientVersion: string;
  deviceId: string;
};

type SpotifyConnectState = {
  raw: JsonRecord;
  playerState?: JsonRecord;
  devices: Record<string, unknown>;
  activeDeviceId?: string;
  originDeviceId?: string;
};

export type SpotifyConnectDeviceSummary = {
  id: string;
  name?: string;
  type?: string;
  isActive: boolean;
  isPrivateSession: boolean;
  isRestricted: boolean;
  volumePercent?: number;
  supportsVolume?: boolean;
};

export type SpotifyConnectTrackSummary = {
  id?: string;
  title?: string;
  artists?: string;
  album?: string;
  duration?: string;
  uri?: string;
  url?: string;
};

export type SpotifyConnectPlaybackSummary = {
  isPlaying: boolean;
  repeatState?: string;
  shuffleState?: string;
  progress?: string;
  progressMs?: number;
  currentlyPlayingType?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  contextUri?: string;
  contextUrl?: string;
  title?: string;
  artists?: string;
  album?: string;
  duration?: string;
  trackId?: string;
  trackUrl?: string;
};

export type SpotifyConnectQueueSummary = {
  current?: SpotifyConnectTrackSummary;
  queue: SpotifyConnectTrackSummary[];
};

export type SpotifyConnectSearchItem = {
  type: SpotifyEntityType;
  id?: string;
  title?: string;
  subtitle?: string;
  detail?: string;
  url?: string;
  imageUrl?: string;
};

export type SpotifyConnectSearchSummary = {
  total: number;
  items: SpotifyConnectSearchItem[];
};

export class SpotifyConnectClient {
  private clientToken?: string;
  private clientTokenExpiresAt?: number;
  private readonly connectDeviceId = randomHex(32);
  private readonly operationHashes = new Map<string, string>();
  private readonly operationHashCachePath: string;
  private operationHashCacheLoaded = false;
  private connectionId?: string;
  private connectionRegisteredAt?: number;

  constructor(
    private readonly client: SessionHttpClient,
    private readonly auth: SpotifyConnectAuth,
  ) {
    this.operationHashCachePath = getCachePath("spotify", `pathfinder-${sanitizeCacheFragment(auth.clientVersion)}.json`);
  }

  async devices(): Promise<SpotifyConnectDeviceSummary[]> {
    const state = await this.getState();
    return this.mapDevices(state);
  }

  async status(): Promise<SpotifyConnectPlaybackSummary> {
    const state = await this.getState();
    return this.mapPlayback(state);
  }

  async queue(): Promise<SpotifyConnectQueueSummary> {
    const state = await this.getState();
    return this.mapQueue(state);
  }

  async search(kind: SpotifyEntityType, query: string, limit = 5, offset = 0): Promise<SpotifyConnectSearchSummary> {
    if (query.trim().length === 0) {
      throw new AutoCliError("INVALID_TARGET", "Spotify search requires a non-empty query.", {
        details: {
          kind,
          query,
        },
      });
    }

    const payload = await this.graphQL("searchDesktop", {
      searchTerm: query,
      offset: Math.max(0, offset),
      limit: Math.max(1, limit),
      numberOfTopResults: 5,
      includeAudiobooks: true,
      includePreReleases: true,
      includeLocalConcertsField: false,
      includeArtistHasConcertsField: false,
    });

    return extractSearchSummary(payload, kind);
  }

  async transfer(target: string): Promise<SpotifyConnectDeviceSummary> {
    const state = await this.getState();
    const device = this.resolveDevice(state, target);
    const fromId = state.originDeviceId ?? state.activeDeviceId;
    if (!fromId) {
      throw new AutoCliError(
        "SPOTIFY_CONNECT_TRANSFER_SOURCE_MISSING",
        "Spotify Connect could not determine the current playback source device.",
        {
          details: {
            target,
          },
        },
      );
    }

    await this.sendConnectCommand(
      `${SPOTIFY_CONNECT_STATE_BASE}/connect/transfer/from/${encodeURIComponent(fromId)}/to/${encodeURIComponent(device.id)}`,
      {
        transfer_options: {
          restore_paused: "resume",
        },
        command_id: randomHex(32),
      },
    );

    return device;
  }

  async play(target?: { type: SpotifyEntityType; id: string }): Promise<void> {
    if (!target) {
      await this.sendStateCommand("resume");
      return;
    }

    const uri = `spotify:${target.type}:${target.id}`;
    const command: JsonRecord = {
      endpoint: "play",
      logging_params: {
        command_id: randomHex(32),
      },
      context: {
        uri,
        url: `context://${uri}`,
      },
    };

    if (!isContextUri(uri)) {
      command.options = {
        skip_to: {
          track_uri: uri,
        },
      };
    }

    await this.sendPlayerCommand(await this.getState(), {
      command,
    });
  }

  async pause(): Promise<void> {
    await this.sendStateCommand("pause");
  }

  async next(): Promise<void> {
    await this.sendStateCommand("skip_next");
  }

  async previous(): Promise<void> {
    await this.sendStateCommand("skip_prev");
  }

  async seek(positionMs: number): Promise<void> {
    await this.sendStateCommand("seek_to", {
      command: {
        endpoint: "seek_to",
        value: Math.max(0, positionMs),
        logging_params: {
          command_id: randomHex(32),
        },
      },
    });
  }

  async volume(volumePercent: number): Promise<void> {
    const state = await this.getState();
    const fromId = state.originDeviceId ?? state.activeDeviceId;
    if (!fromId || !state.activeDeviceId) {
      throw new AutoCliError("SPOTIFY_CONNECT_DEVICE_NOT_FOUND", "Spotify Connect could not determine an active device.", {
        details: {
          activeDeviceId: state.activeDeviceId,
          originDeviceId: state.originDeviceId,
        },
      });
    }

    await this.sendConnectCommand(
      `${SPOTIFY_CONNECT_STATE_BASE}/connect/volume/from/${encodeURIComponent(fromId)}/to/${encodeURIComponent(state.activeDeviceId)}`,
      {
        volume: Math.round((clamp(volumePercent, 0, 100) / 100) * 65535),
      },
    );
  }

  async shuffle(enabled: boolean): Promise<void> {
    await this.sendStateCommand("set_shuffling_context", {
      command: {
        endpoint: "set_shuffling_context",
        value: enabled,
        logging_params: {
          command_id: randomHex(32),
        },
      },
    });
  }

  async repeat(mode: SpotifyRepeatState): Promise<void> {
    const command: JsonRecord = {
      endpoint: "set_options",
      logging_params: {
        command_id: randomHex(32),
      },
      repeating_track: mode === "track",
      repeating_context: mode === "context",
    };
    await this.sendStateCommand("set_options", { command });
  }

  async queueAdd(trackId: string): Promise<void> {
    await this.sendStateCommand("add_to_queue", {
      command: {
        endpoint: "add_to_queue",
        track: {
          uri: `spotify:track:${trackId}`,
        },
        logging_params: {
          command_id: randomHex(32),
        },
      },
    });
  }

  private async sendStateCommand(endpoint: string, payload?: JsonRecord): Promise<void> {
    const state = await this.getState();
    const body = payload ?? {
      command: {
        endpoint,
        logging_params: {
          command_id: randomHex(32),
        },
      },
    };
    await this.sendPlayerCommand(state, body);
  }

  private async sendPlayerCommand(state: SpotifyConnectState, payload: JsonRecord): Promise<void> {
    const fromId = state.originDeviceId ?? this.connectDeviceId ?? state.activeDeviceId;
    if (!fromId || !state.activeDeviceId) {
      throw new AutoCliError("SPOTIFY_CONNECT_DEVICE_NOT_FOUND", "Spotify Connect could not determine an active device.", {
        details: {
          activeDeviceId: state.activeDeviceId,
          originDeviceId: state.originDeviceId,
        },
      });
    }

    await this.sendConnectCommand(
      `${SPOTIFY_CONNECT_STATE_BASE}/player/command/from/${encodeURIComponent(fromId)}/to/${encodeURIComponent(state.activeDeviceId)}`,
      payload,
    );
  }

  private async sendConnectCommand(url: string, body: JsonRecord): Promise<void> {
    await this.request(url, {
      method: "POST",
      headers: await this.createConnectHeaders({
        contentType: "application/json",
      }),
      body: JSON.stringify(body),
      expectedStatus: [200, 202, 204],
      responseType: "text",
    });
  }

  private async getState(): Promise<SpotifyConnectState> {
    await this.ensureConnectRegistration();

    const response = await this.request<JsonRecord>(
      `${SPOTIFY_CONNECT_STATE_BASE}/devices/hobs_${encodeURIComponent(this.connectDeviceId)}`,
      {
        method: "PUT",
        headers: await this.createConnectHeaders({
          contentType: "application/json",
          connectionId: this.connectionId,
        }),
        body: JSON.stringify({
          member_type: "CONNECT_STATE",
          device: {
            device_info: {
              capabilities: {
                can_be_player: false,
                hidden: true,
                needs_full_player_state: true,
              },
            },
          },
        }),
        expectedStatus: 200,
      },
    );

    const devices = asRecord(response.devices) ?? {};
    const playerState = asRecord(response.player_state);
    const activeDeviceId = getString(response, "active_device_id") || detectActiveDeviceId(devices);
    const originDeviceId = mapPlayOriginId(playerState);

    return {
      raw: response,
      playerState,
      devices,
      activeDeviceId: activeDeviceId || undefined,
      originDeviceId: originDeviceId || undefined,
    };
  }

  private async ensureConnectRegistration(): Promise<void> {
    const now = Date.now();
    if (this.connectionId && this.connectionRegisteredAt && now - this.connectionRegisteredAt < 9 * 60 * 1000) {
      return;
    }

    const connectionId = await this.getConnectionId();
    await this.registerDevice(connectionId);
    this.connectionId = connectionId;
    this.connectionRegisteredAt = now;
  }

  private async registerDevice(connectionId: string): Promise<void> {
    await this.request(`${SPOTIFY_TRACK_PLAYBACK_BASE}/devices`, {
      method: "POST",
      headers: await this.createConnectHeaders({
        contentType: "application/json",
      }),
      body: JSON.stringify({
        device: {
          device_id: this.connectDeviceId,
          device_type: "computer",
          brand: "spotify",
          model: SPOTIFY_CONNECT_DEVICE_MODEL,
          name: SPOTIFY_CONNECT_DEVICE_NAME,
          is_group: false,
          metadata: {},
          platform_identifier: `web_player ${runtimeOs()};autocli`,
          capabilities: {
            change_volume: true,
            supports_file_media_type: true,
            enable_play_token: true,
            play_token_lost_behavior: "pause",
            disable_connect: false,
            audio_podcasts: true,
            video_playback: true,
            manifest_formats: ["file_ids_mp3", "file_urls_mp3", "file_ids_mp4", "manifest_ids_video"],
          },
        },
        outro_endcontent_snooping: false,
        connection_id: connectionId,
        client_version: SPOTIFY_CONNECT_VERSION,
        volume: 65535,
      }),
      expectedStatus: [200, 201, 202, 204],
      responseType: "text",
    });
  }

  private async getConnectionId(): Promise<string> {
    const url = new URL(SPOTIFY_DEALER_URL);
    url.searchParams.set("access_token", this.auth.accessToken);

    return await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(url.toString(), {
        headers: {
          "user-agent": SPOTIFY_USER_AGENT,
        },
      });

      const timer = setTimeout(() => {
        socket.close();
        reject(
          new AutoCliError("SPOTIFY_CONNECT_DEALER_TIMEOUT", "Spotify Connect dealer handshake timed out.", {
            details: {
              url: url.toString(),
            },
          }),
        );
      }, 10_000);

      socket.once("message", (data: RawData) => {
        clearTimeout(timer);
        try {
          const text = rawDataToText(data);
          const payload = JSON.parse(text) as JsonRecord;
          const headers = asRecord(payload.headers);
          const connectionId = findCaseInsensitiveString(headers, "Spotify-Connection-Id");
          if (!connectionId) {
            reject(
              new AutoCliError("SPOTIFY_CONNECT_DEALER_INVALID", "Spotify Connect dealer response did not include a connection id.", {
                details: {
                  payload,
                },
              }),
            );
            return;
          }

          resolve(connectionId);
        } catch (error) {
          reject(
            new AutoCliError("SPOTIFY_CONNECT_DEALER_INVALID", "Spotify Connect dealer returned an invalid handshake payload.", {
              cause: error,
            }),
          );
        } finally {
          socket.close();
        }
      });

      socket.once("error", (error: Error) => {
        clearTimeout(timer);
        reject(
          new AutoCliError("SPOTIFY_CONNECT_DEALER_FAILED", "Spotify Connect dealer handshake failed.", {
            cause: error,
            details: {
              url: url.toString(),
            },
          }),
        );
      });
    });
  }

  private async ensureClientToken(): Promise<string> {
    if (this.clientToken && this.clientTokenExpiresAt && this.clientTokenExpiresAt - Date.now() > 60_000) {
      return this.clientToken;
    }

    const response = await this.request<{
      granted_token?: {
        token?: string;
        expires_in?: number;
      };
    }>(SPOTIFY_CLIENT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": SPOTIFY_USER_AGENT,
      },
      body: JSON.stringify({
        client_data: {
          client_version: this.auth.clientVersion,
          client_id: this.auth.clientId,
          js_sdk_data: {
            device_brand: "unknown",
            device_model: "unknown",
            os: runtimeOs(),
            os_version: "unknown",
            device_id: this.auth.deviceId,
            device_type: "computer",
          },
        },
      }),
      expectedStatus: 200,
    });

    const token = response.granted_token?.token;
    if (!token) {
      throw new AutoCliError("SPOTIFY_CONNECT_CLIENT_TOKEN_MISSING", "Spotify client-token bootstrap did not return a token.");
    }

    this.clientToken = token;
    this.clientTokenExpiresAt = Date.now() + Math.max(300, response.granted_token?.expires_in ?? 1800) * 1000;
    return token;
  }

  private async graphQL(operation: string, variables: Record<string, unknown>): Promise<JsonRecord> {
    const hash = await this.resolveOperationHash(operation);
    const params = new URLSearchParams({
      operationName: operation,
      variables: JSON.stringify(variables),
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: hash,
        },
      }),
    });

    const response = await this.request<JsonRecord>(`${SPOTIFY_PATHFINDER_ENDPOINT}?${params.toString()}`, {
      method: "POST",
      headers: await this.createConnectHeaders(),
      expectedStatus: 200,
    });

    const pathfinderErrors = Array.isArray(response.errors) ? response.errors : [];
    if (pathfinderErrors.length > 0) {
      const firstError = asRecord(pathfinderErrors[0]);
      throw new AutoCliError(
        "SPOTIFY_PATHFINDER_ERROR",
        typeof firstError?.message === "string" && firstError.message.length > 0 ? firstError.message : "Spotify pathfinder request failed.",
        {
          details: {
            operation,
            errors: pathfinderErrors,
          },
        },
      );
    }

    return response;
  }

  private async resolveOperationHash(operation: string): Promise<string> {
    await this.loadOperationHashesFromCache();
    const cached = this.operationHashes.get(operation);
    if (cached) {
      return cached;
    }

    await this.loadOperationHashes([operation]);
    const resolved = this.operationHashes.get(operation);
    if (!resolved) {
      throw new AutoCliError("SPOTIFY_PATHFINDER_HASH_NOT_FOUND", `Spotify web-player hash for ${operation} was not found.`, {
        details: {
          operation,
        },
      });
    }

    return resolved;
  }

  private async loadOperationHashes(operations: string[]): Promise<void> {
    await this.loadOperationHashesFromCache();
    const missing = operations.filter((operation) => !this.operationHashes.get(operation));
    if (missing.length === 0) {
      return;
    }

    const homeHtml = await this.client.request<string>("https://open.spotify.com/", {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const mainBundleUrl = pickWebPlayerBundle(homeHtml);
    const mainBody = await this.client.request<string>(mainBundleUrl, {
      responseType: "text",
      expectedStatus: 200,
    });

    const directMatches = findOperationHashes(mainBody, missing);
    for (const [operation, hash] of Object.entries(directMatches)) {
      this.operationHashes.set(operation, hash);
    }

    let remaining = missing.filter((operation) => !this.operationHashes.get(operation));
    if (remaining.length === 0) {
      return;
    }

    const [nameMap, hashMap] = parseWebpackMaps(mainBody);
    const bundleBase = bundleBaseUrl(mainBundleUrl);
    const chunkNames = combineChunkNames(nameMap, hashMap);

    for (const chunkName of chunkNames) {
      if (remaining.length === 0) {
        break;
      }

      try {
        const chunkBody = await this.client.request<string>(new URL(chunkName, bundleBase).toString(), {
          responseType: "text",
          expectedStatus: 200,
        });
        const chunkMatches = findOperationHashes(chunkBody, remaining);
        for (const [operation, hash] of Object.entries(chunkMatches)) {
          this.operationHashes.set(operation, hash);
        }
        remaining = remaining.filter((operation) => !this.operationHashes.get(operation));
      } catch {
        continue;
      }
    }

    await this.persistOperationHashesToCache();
  }

  private async loadOperationHashesFromCache(): Promise<void> {
    if (this.operationHashCacheLoaded) {
      return;
    }

    this.operationHashCacheLoaded = true;

    try {
      const raw = await readFile(this.operationHashCachePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [operation, hash] of Object.entries(parsed)) {
        if (typeof hash === "string" && hash.length === 64) {
          this.operationHashes.set(operation, hash);
        }
      }
    } catch {
      return;
    }
  }

  private async persistOperationHashesToCache(): Promise<void> {
    if (this.operationHashes.size === 0) {
      return;
    }

    try {
      await ensureParentDirectory(this.operationHashCachePath);
      await writeFile(this.operationHashCachePath, JSON.stringify(Object.fromEntries(this.operationHashes), null, 2));
    } catch {
      return;
    }
  }

  private async createConnectHeaders(input: {
    contentType?: string;
    connectionId?: string;
  } = {}): Promise<Record<string, string>> {
    const clientToken = await this.ensureClientToken();
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${this.auth.accessToken}`,
      "client-token": clientToken,
      "spotify-app-version": SPOTIFY_CONNECT_VERSION,
      "app-platform": SPOTIFY_APP_PLATFORM,
      "user-agent": SPOTIFY_USER_AGENT,
    };

    if (input.contentType) {
      headers["content-type"] = input.contentType;
    }

    if (input.connectionId) {
      headers["x-spotify-connection-id"] = input.connectionId;
    }

    return headers;
  }

  private async request<T = unknown>(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: BodyInit | null;
      expectedStatus?: number | number[];
      responseType?: "json" | "text";
    } = {},
  ): Promise<T> {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    const expected = normalizeExpectedStatus(options.expectedStatus);
    if ((expected.length > 0 && !expected.includes(response.status)) || (expected.length === 0 && !response.ok)) {
      const body = await response.text().catch(() => "");
      throw new AutoCliError("SPOTIFY_CONNECT_REQUEST_FAILED", `Spotify Connect request failed with ${response.status} ${response.statusText}.`, {
        details: {
          url,
          status: response.status,
          statusText: response.statusText,
          body: body.slice(0, 600),
        },
      });
    }

    if (options.responseType === "text") {
      return (await response.text()) as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new AutoCliError("SPOTIFY_CONNECT_INVALID_JSON", "Spotify Connect returned invalid JSON.", {
        cause: error,
        details: {
          url,
          preview: text.slice(0, 200),
        },
      });
    }
  }

  private mapDevices(state: SpotifyConnectState): SpotifyConnectDeviceSummary[] {
    const devices: SpotifyConnectDeviceSummary[] = [];

    for (const [id, raw] of Object.entries(state.devices)) {
      const device = asRecord(raw);
      if (!device) {
        continue;
      }

      const volume = getNumber(device, "volume") ?? getNumber(device, "volume_percent");
      devices.push({
        id,
        name: getString(device, "name") || getString(device, "device_name") || undefined,
        type: getString(device, "device_type") || undefined,
        isActive:
          id === state.activeDeviceId ||
          getBoolean(device, "is_active") ||
          getBoolean(device, "is_currently_playing") ||
          getBoolean(device, "is_active_device"),
        isPrivateSession: false,
        isRestricted: getBoolean(device, "is_restricted"),
        volumePercent: typeof volume === "number" ? clamp(Math.round(volume), 0, 100) : undefined,
        supportsVolume: true,
      });
    }

    return devices;
  }

  private mapPlayback(state: SpotifyConnectState): SpotifyConnectPlaybackSummary {
    const player = state.playerState;
    const track = extractTrack(player);
    const activeDevice = this.mapDevices(state).find((device) => device.isActive);
    const progressMs = getNumber(player, "position_as_of_timestamp") ?? getNumber(player, "position_ms");

    return {
      isPlaying: player ? !(getBoolean(player, "is_paused") ?? false) : false,
      repeatState: getString(player, "repeat_mode") || getString(player, "repeat") || undefined,
      shuffleState: player ? (getBoolean(player, "shuffle") ? "on" : "off") : undefined,
      progress: typeof progressMs === "number" ? formatSpotifyDuration(progressMs) : undefined,
      progressMs: progressMs ?? undefined,
      currentlyPlayingType: getString(player, "currently_playing_type") || undefined,
      deviceId: activeDevice?.id,
      deviceName: activeDevice?.name,
      deviceType: activeDevice?.type,
      contextUri: getString(player, "context_uri") || getString(player, "context_uri_string") || undefined,
      contextUrl: spotifyUriToUrl(getString(player, "context_uri") || getString(player, "context_uri_string")),
      title: track?.title,
      artists: track?.artists,
      album: track?.album,
      duration: track?.duration,
      trackId: track?.id,
      trackUrl: track?.url,
    };
  }

  private mapQueue(state: SpotifyConnectState): SpotifyConnectQueueSummary {
    const player = state.playerState;
    const nextTracks = Array.isArray(player?.next_tracks) ? player.next_tracks : [];
    return {
      current: extractTrack(player),
      queue: nextTracks.map((entry) => extractTrack(entry)).filter((track): track is SpotifyConnectTrackSummary => Boolean(track)),
    };
  }

  private resolveDevice(state: SpotifyConnectState, target: string): SpotifyConnectDeviceSummary {
    const devices = this.mapDevices(state);
    const trimmed = target.trim();
    const normalized = trimmed.toLowerCase();

    const exactId = devices.find((device) => device.id === trimmed);
    if (exactId) {
      return exactId;
    }

    if (normalized === "active") {
      const active = devices.find((device) => device.isActive);
      if (active) {
        return active;
      }
    }

    const exactName = devices.find((device) => typeof device.name === "string" && device.name.toLowerCase() === normalized);
    if (exactName) {
      return exactName;
    }

    const partialName = devices.find((device) => typeof device.name === "string" && device.name.toLowerCase().includes(normalized));
    if (partialName) {
      return partialName;
    }

    throw new AutoCliError("SPOTIFY_DEVICE_NOT_FOUND", `Spotify device "${target}" was not found.`, {
      details: {
        target,
        availableDevices: devices,
      },
    });
  }
}

function normalizeExpectedStatus(expected?: number | number[]): number[] {
  if (typeof expected === "number") {
    return [expected];
  }

  return expected ?? [];
}

function randomHex(size: number): string {
  if (size <= 0) {
    return "";
  }

  return randomBytes(Math.ceil(size / 2)).toString("hex").slice(0, size);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function runtimeOs(): string {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

function getString(value: unknown, key: string): string {
  const record = asRecord(value);
  const next = record?.[key];
  return typeof next === "string" ? next : "";
}

function getNumber(value: unknown, key: string): number | undefined {
  const record = asRecord(value);
  const next = record?.[key];
  return typeof next === "number" && Number.isFinite(next) ? next : undefined;
}

function getBoolean(value: unknown, key: string): boolean {
  const record = asRecord(value);
  return typeof record?.[key] === "boolean" ? (record[key] as boolean) : false;
}

function findCaseInsensitiveString(value: unknown, key: string): string | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized = key.toLowerCase();
  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (entryKey.toLowerCase() === normalized && typeof entryValue === "string" && entryValue.length > 0) {
      return entryValue;
    }
  }

  return undefined;
}

function detectActiveDeviceId(devices: Record<string, unknown>): string {
  for (const [id, raw] of Object.entries(devices)) {
    if (getBoolean(raw, "is_active") || getBoolean(raw, "is_currently_playing") || getBoolean(raw, "is_active_device")) {
      return id;
    }
  }

  return "";
}

function mapPlayOriginId(player: unknown): string {
  const playOrigin = asRecord(asRecord(player)?.play_origin);
  return typeof playOrigin?.device_identifier === "string" ? playOrigin.device_identifier : "";
}

function isContextUri(uri: string): boolean {
  return !(uri.startsWith("spotify:track:") || uri.startsWith("spotify:episode:"));
}

function extractTrack(value: unknown): SpotifyConnectTrackSummary | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const track = asRecord(record.track) ?? asRecord(record.item) ?? asRecord(record.current_track) ?? record;
  const uri = findFirstUri(track, "track") ?? findFirstUri(track);
  if (!uri || !uri.startsWith("spotify:track:")) {
    return undefined;
  }

  const artists = extractArtistNames(track);
  const album = extractAlbumName(track);
  const durationMs = getNumber(track, "duration_ms") ?? getNumber(track, "durationMs");
  const id = idFromUri(uri);

  return {
    id,
    title: findFirstName(track) || undefined,
    artists: artists.length > 0 ? artists.join(", ") : undefined,
    album: album || undefined,
    duration: typeof durationMs === "number" ? formatSpotifyDuration(durationMs) : undefined,
    uri,
    url: spotifyUriToUrl(uri) ?? (id ? `https://open.spotify.com/track/${id}` : undefined),
  };
}

function extractArtistNames(value: unknown): string[] {
  const names: string[] = [];
  walkMaps(value, (record) => {
    if (Array.isArray(record.artists)) {
      for (const artist of record.artists) {
        const artistRecord = asRecord(artist);
        const name = getString(artistRecord, "name") || getString(asRecord(artistRecord?.profile), "name");
        if (name) {
          names.push(name);
        }
      }
    }

    const firstArtist = asRecord(record.firstArtist);
    if (firstArtist) {
      for (const key of ["items", "nodes", "edges"] as const) {
        const entries = firstArtist[key];
        if (!Array.isArray(entries)) {
          continue;
        }

        for (const entry of entries) {
          const entryRecord = asRecord(entry);
          const node = asRecord(entryRecord?.node) ?? entryRecord;
          const profile = asRecord(node?.profile);
          const name = getString(profile, "name") || getString(node, "name");
          if (name) {
            names.push(name);
          }
        }
      }
    }
  });

  return [...new Set(names.filter(Boolean))];
}

function extractAlbumName(value: unknown): string {
  let album = "";
  walkMaps(value, (record) => {
    if (album) {
      return;
    }

    const fromAlbum = getString(asRecord(record.album), "name");
    if (fromAlbum) {
      album = fromAlbum;
      return;
    }

    const fromAlbumOfTrack = getString(asRecord(record.albumOfTrack), "name");
    if (fromAlbumOfTrack) {
      album = fromAlbumOfTrack;
    }
  });
  return album;
}

function walkMaps(value: unknown, visitor: (record: JsonRecord) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkMaps(entry, visitor);
    }
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  visitor(record);
  for (const entry of Object.values(record)) {
    walkMaps(entry, visitor);
  }
}

function findFirstName(value: unknown): string {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const name = findFirstName(entry);
      if (name) {
        return name;
      }
    }
    return "";
  }

  const record = asRecord(value);
  if (!record) {
    return "";
  }

  if (typeof record.name === "string" && record.name.length > 0) {
    return record.name;
  }

  if (typeof record.title === "string" && record.title.length > 0) {
    return record.title;
  }

  for (const entry of Object.values(record)) {
    const name = findFirstName(entry);
    if (name) {
      return name;
    }
  }

  return "";
}

function findFirstUri(value: unknown, kind?: string): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const uri = findFirstUri(entry, kind);
      if (uri) {
        return uri;
      }
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  if (typeof record.uri === "string" && record.uri.startsWith("spotify:")) {
    if (!kind || record.uri.startsWith(`spotify:${kind}:`)) {
      return record.uri;
    }
  }

  if (kind && typeof record.id === "string" && record.id.length > 0) {
    return `spotify:${kind}:${record.id}`;
  }

  for (const entry of Object.values(record)) {
    const uri = findFirstUri(entry, kind);
    if (uri) {
      return uri;
    }
  }

  return undefined;
}

function idFromUri(uri: string): string | undefined {
  const parts = uri.split(":");
  return parts.length >= 3 ? parts.at(-1) : undefined;
}

function rawDataToText(data: RawData): string {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data.map((entry) => Buffer.isBuffer(entry) ? entry : Buffer.from(entry))).toString("utf8");
  }

  return Buffer.from(data).toString("utf8");
}

function extractSearchSummary(payload: JsonRecord, kind: SpotifyEntityType): SpotifyConnectSearchSummary {
  for (const path of searchContainerPaths(kind)) {
    const container = getRecordAtPath(payload, path);
    if (!container) {
      continue;
    }

    const items = extractSearchItemsFromContainer(container, kind);
    const total = getNumber(container, "totalCount") ?? items.length;
    return {
      total,
      items,
    };
  }

  const items = collectSearchItemsByKind(payload, kind);
  return {
    total: items.length,
    items,
  };
}

function searchContainerPaths(kind: SpotifyEntityType): string[][] {
  switch (kind) {
    case "track":
      return [["data", "searchV2", "tracksV2"]];
    case "album":
      return [["data", "searchV2", "albumsV2"], ["data", "searchV2", "albums"]];
    case "artist":
      return [["data", "searchV2", "artists"]];
    case "playlist":
      return [["data", "searchV2", "playlists"]];
    default:
      return [];
  }
}

function getRecordAtPath(value: unknown, path: string[]): JsonRecord | undefined {
  let current: unknown = value;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) {
      return undefined;
    }

    current = record[segment];
  }

  return asRecord(current);
}

function extractSearchItemsFromContainer(container: JsonRecord, kind: SpotifyEntityType): SpotifyConnectSearchItem[] {
  const rawItems = Array.isArray(container.items) ? container.items : [];
  if (rawItems.length === 0) {
    return collectSearchItemsByKind(container, kind);
  }

  const items = rawItems
    .map((item) => extractSearchItem(item, kind))
    .filter((item): item is SpotifyConnectSearchItem => Boolean(item));

  return items.length > 0 ? dedupeSearchItems(items) : collectSearchItemsByKind(container, kind);
}

function collectSearchItemsByKind(value: unknown, kind: SpotifyEntityType): SpotifyConnectSearchItem[] {
  const items: SpotifyConnectSearchItem[] = [];

  walkMaps(value, (record) => {
    const item = extractSearchItem(record, kind);
    if (item) {
      items.push(item);
    }
  });

  return dedupeSearchItems(items);
}

function extractSearchItem(value: unknown, kind: SpotifyEntityType): SpotifyConnectSearchItem | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const candidate =
    asRecord(record.data) ??
    asRecord(record.item) ??
    (kind === "track" ? asRecord(record.track) : undefined) ??
    record;
  const uri = findFirstUri(candidate, kind);
  if (!uri || !uri.startsWith(`spotify:${kind}:`)) {
    return undefined;
  }

  const id = idFromUri(uri);
  const title = findFirstName(candidate) || undefined;
  const artists = extractArtistNames(candidate);
  const fallbackArtists = artists.length > 0 ? artists : extractArtistNames(record);
  const album = extractAlbumName(candidate) || extractAlbumName(record);
  const owner = extractOwnerName(candidate) || extractOwnerName(record);
  const durationMs =
    getNumber(candidate, "duration_ms") ??
    getNumber(candidate, "durationMs") ??
    getNumber(record, "duration_ms") ??
    getNumber(record, "durationMs");
  const totalTracks =
    getNumber(candidate, "totalTracks") ??
    getNumber(candidate, "totalCount") ??
    getNumber(candidate, "total") ??
    getNumber(record, "totalTracks") ??
    getNumber(record, "totalCount") ??
    getNumber(record, "total");
  const releaseDate =
    getString(candidate, "releaseDate") ||
    getString(candidate, "date") ||
    getString(candidate, "release_date") ||
    getString(record, "releaseDate") ||
    getString(record, "date") ||
    getString(record, "release_date");
  const followers =
    getNumber(asRecord(candidate.followers), "total") ??
    getNumber(candidate, "followers") ??
    getNumber(asRecord(candidate.stats), "followers") ??
    getNumber(asRecord(record.followers), "total") ??
    getNumber(record, "followers") ??
    getNumber(asRecord(record.stats), "followers");

  return {
    type: kind,
    id,
    title,
    subtitle:
      kind === "track" || kind === "album"
        ? fallbackArtists.length > 0
          ? fallbackArtists.join(", ")
          : undefined
        : kind === "artist"
          ? typeof followers === "number"
            ? `${followers.toLocaleString("en-US")} followers`
            : undefined
          : owner || undefined,
    detail:
      kind === "track"
        ? [album || undefined, typeof durationMs === "number" ? formatSpotifyDuration(durationMs) : undefined]
            .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
            .join(" • ") || undefined
        : kind === "album"
          ? [releaseDate || undefined, typeof totalTracks === "number" ? `${totalTracks} tracks` : undefined]
              .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
              .join(" • ") || undefined
          : kind === "playlist"
            ? typeof totalTracks === "number"
              ? `${totalTracks} tracks`
              : undefined
            : undefined,
    url: spotifyUriToUrl(uri) ?? (id ? `https://open.spotify.com/${kind}/${id}` : undefined),
    imageUrl: extractImageUrl(candidate) ?? extractImageUrl(record),
  };
}

function dedupeSearchItems(items: SpotifyConnectSearchItem[]): SpotifyConnectSearchItem[] {
  const seen = new Set<string>();
  const unique: SpotifyConnectSearchItem[] = [];

  for (const item of items) {
    const key = `${item.type}:${item.id ?? item.url ?? item.title ?? ""}`;
    if (!item.id && !item.url && !item.title) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function extractOwnerName(value: unknown): string {
  let owner = "";

  walkMaps(value, (record) => {
    if (owner) {
      return;
    }

    const nestedOwner = asRecord(record.owner);
    if (nestedOwner) {
      owner = getString(nestedOwner, "name") || getString(nestedOwner, "display_name") || getString(nestedOwner, "username");
      if (owner) {
        return;
      }
    }

    const ownerV2Data = asRecord(asRecord(record.ownerV2)?.data);
    if (ownerV2Data) {
      owner = getString(ownerV2Data, "name") || getString(ownerV2Data, "username");
      if (owner) {
        return;
      }
    }

    const nestedUser = asRecord(record.user);
    if (nestedUser) {
      owner = getString(nestedUser, "name") || getString(nestedUser, "display_name") || getString(nestedUser, "username");
    }
  });

  return owner;
}

function extractImageUrl(value: unknown): string | undefined {
  let imageUrl: string | undefined;

  walkMaps(value, (record) => {
    if (imageUrl) {
      return;
    }

    for (const source of [
      record.images,
      record.sources,
      asRecord(record.coverArt)?.sources,
      asRecord(asRecord(record.visuals)?.avatarImage)?.sources,
      asRecord(record.avatarImage)?.sources,
    ]) {
      const resolved = firstImageUrl(source);
      if (resolved) {
        imageUrl = resolved;
        return;
      }
    }

    if (typeof record.url === "string" && /^https?:\/\//.test(record.url) && /\.(?:png|jpe?g|webp)(?:\?|$)/i.test(record.url)) {
      imageUrl = record.url;
    }
  });

  return imageUrl;
}

function firstImageUrl(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = asRecord(entry);
      if (record && typeof record.url === "string" && record.url.length > 0) {
        return record.url;
      }
    }
  }

  const record = asRecord(value);
  if (record && typeof record.url === "string" && record.url.length > 0) {
    return record.url;
  }

  return undefined;
}

function pickWebPlayerBundle(html: string): string {
  const matches = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)];
  for (const match of matches) {
    const source = match[1];
    if (!source) {
      continue;
    }

    if (source.endsWith(".js") && (source.includes("/web-player/") || source.includes("/mobile-web-player/"))) {
      return new URL(source, "https://open.spotify.com/").toString();
    }
  }

  throw new AutoCliError("SPOTIFY_PATHFINDER_BUNDLE_NOT_FOUND", "Spotify web-player bundle could not be located.");
}

function bundleBaseUrl(bundleUrl: string): string {
  return bundleUrl.slice(0, bundleUrl.lastIndexOf("/") + 1);
}

function parseWebpackMaps(js: string): [Map<number, string>, Map<number, string>] {
  const matches = js.match(/\{(?:\d+:"[^"]+",?)+\}/g) ?? [];
  if (matches.length === 0) {
    throw new AutoCliError("SPOTIFY_PATHFINDER_MAPS_NOT_FOUND", "Spotify webpack chunk maps could not be located.");
  }

  const hashMaps: Array<{ score: number; values: Map<number, string> }> = [];
  const nameMaps: Array<{ score: number; values: Map<number, string> }> = [];

  for (const match of matches) {
    const parsed = parseMapLiteral(match);
    if (parsed.size === 0) {
      continue;
    }

    const hashScore = scoreHashMap(parsed);
    const nameScore = scoreNameMap(parsed);

    if (hashScore > 0.4) {
      hashMaps.push({ score: hashScore, values: parsed });
    }

    if (nameScore > 0.4) {
      nameMaps.push({ score: nameScore, values: parsed });
    }
  }

  hashMaps.sort((left, right) => right.score - left.score);
  nameMaps.sort((left, right) => right.score - left.score);

  const bestNames = nameMaps[0]?.values;
  const bestHashes = hashMaps[0]?.values;
  if (!bestNames || !bestHashes) {
    throw new AutoCliError("SPOTIFY_PATHFINDER_MAPS_NOT_FOUND", "Spotify webpack chunk maps could not be resolved.");
  }

  return [bestNames, bestHashes];
}

function parseMapLiteral(raw: string): Map<number, string> {
  const jsonLike = raw.replace(/(\d+):/g, '"$1":');

  try {
    const parsed = JSON.parse(jsonLike) as Record<string, unknown>;
    const values = new Map<number, string>();
    for (const [key, value] of Object.entries(parsed)) {
      const index = Number.parseInt(key, 10);
      if (!Number.isFinite(index) || typeof value !== "string") {
        continue;
      }

      values.set(index, value);
    }

    return values;
  } catch {
    return new Map<number, string>();
  }
}

function scoreHashMap(values: Map<number, string>): number {
  if (values.size === 0) {
    return 0;
  }

  let hits = 0;
  for (const value of values.values()) {
    if (/^[a-f0-9]{6,12}$/i.test(value)) {
      hits += 1;
    }
  }

  return hits / values.size;
}

function scoreNameMap(values: Map<number, string>): number {
  if (values.size === 0) {
    return 0;
  }

  let hits = 0;
  for (const value of values.values()) {
    if (value.includes("-") || value.includes("/")) {
      hits += 1;
    }
  }

  return hits / values.size;
}

function combineChunkNames(nameMap: Map<number, string>, hashMap: Map<number, string>): string[] {
  const entries = [...nameMap.entries()].sort((left, right) => left[0] - right[0]);
  const chunks: string[] = [];

  for (const [key, name] of entries) {
    const hash = hashMap.get(key);
    if (!name || !hash) {
      continue;
    }

    chunks.push(`${name}.${hash}.js`);
  }

  return chunks;
}

function findOperationHashes(body: string, operations: string[]): Record<string, string> {
  const matches: Record<string, string> = {};

  for (const operation of operations) {
    if (!operation) {
      continue;
    }

    const escaped = operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hashedQuery =
      body.match(new RegExp(`${escaped}.{0,400}?sha256Hash":"([a-f0-9]{64})`, "s"))?.[1] ??
      body.match(new RegExp(`"${escaped}","(?:query|mutation)","([a-f0-9]{64})"`))?.[1];

    if (hashedQuery) {
      matches[operation] = hashedQuery;
    }
  }

  return matches;
}

function sanitizeCacheFragment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return normalized.length > 0 ? normalized : "unknown";
}
