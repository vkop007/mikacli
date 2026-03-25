import { AutoCliError, isAutoCliError } from "../../../errors.js";
import { maybeAutoRefreshSession } from "../../../utils/autorefresh.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import {
  parseSpotifyAlbumTarget,
  parseSpotifyArtistTarget,
  parseSpotifyEntityTarget,
  parseSpotifyPlaylistTarget,
  parseSpotifyTrackTarget,
  type SpotifyEntityType,
} from "../../../utils/targets.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";
import {
  buildSpotifyEntityUrl,
  cleanSpotifyText,
  extractSpotifyScriptPayload,
  formatSpotifyDate,
  formatSpotifyDuration,
  pickSpotifyImageUrl,
  spotifyUriToUrl,
  type SpotifyImageSource,
} from "./helpers.js";
import {
  SpotifyConnectClient,
  type SpotifyConnectDeviceSummary,
  type SpotifyConnectPlaybackSummary,
  type SpotifyConnectTrackSummary,
} from "./connect.js";
import {
  SPOTIFY_API_BASE,
  SPOTIFY_HOME,
  SPOTIFY_ORIGIN,
  SPOTIFY_SERVER_TIME_ENDPOINT,
  SPOTIFY_TOKEN_ENDPOINT,
  SPOTIFY_USER_AGENT,
} from "./constants.js";
import {
  parseSpotifyPercentValue,
  parseSpotifyPositionValue,
  parseSpotifyRepeatState,
  type SpotifyEngine,
} from "./options.js";
import { buildSpotifyTokenQueryParameters, getSpotifyTokenSecretCandidates } from "./auth.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../../../types.js";

interface SpotifyProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

interface SpotifyAppServerConfig {
  isAnonymous?: boolean;
  isPremium?: boolean;
  market?: string;
  buildDate?: string;
  clientVersion?: string;
  locale?: {
    locale?: string;
  };
}

interface SpotifyTokenResponse {
  accessToken?: string;
  accessTokenExpirationTimestampMs?: number;
  isAnonymous?: boolean;
  clientId?: string;
  tokenType?: string;
}

interface SpotifyServerTimeResponse {
  serverTime?: number;
}

interface SpotifyMeResponse {
  id?: string;
  display_name?: string;
  email?: string;
  country?: string;
  product?: string;
  external_urls?: {
    spotify?: string;
  };
}

interface SpotifySearchInput {
  account?: string;
  query: string;
  type?: "track" | "album" | "artist" | "playlist";
  limit?: number;
}

interface SpotifyListInput {
  account?: string;
  limit?: number;
  offset?: number;
}

interface SpotifyTopInput {
  account?: string;
  type: "tracks" | "artists";
  range?: "short_term" | "medium_term" | "long_term";
  limit?: number;
}

interface SpotifyPlaylistCreateInput {
  account?: string;
  name: string;
  description?: string;
  public?: boolean;
  collaborative?: boolean;
}

interface SpotifyPlaylistMutationInput {
  account?: string;
  playlist: string;
  targets: string[];
}

interface SpotifyPlaylistTracksInput extends SpotifyListInput {
  target: string;
}

interface SpotifyEntityInput {
  target: string;
  limit?: number;
}

interface SpotifyAuthInput {
  account?: string;
}

interface SpotifyPlaybackCommandInput {
  account?: string;
  device?: string;
  engine?: SpotifyEngine;
}

interface SpotifyPlaybackStatusInput {
  account?: string;
  engine?: SpotifyEngine;
}

interface SpotifyPlayInput extends SpotifyPlaybackCommandInput {
  target?: string;
  type?: "track" | "album" | "artist" | "playlist";
}

interface SpotifyTransferInput {
  account?: string;
  target: string;
  play?: boolean;
  engine?: SpotifyEngine;
}

interface SpotifySeekInput extends SpotifyPlaybackCommandInput {
  position: string;
}

interface SpotifyVolumeInput extends SpotifyPlaybackCommandInput {
  percent: string;
}

interface SpotifyShuffleInput extends SpotifyPlaybackCommandInput {
  state: boolean;
}

interface SpotifyRepeatInput extends SpotifyPlaybackCommandInput {
  state: string;
}

interface SpotifyQueueAddInput extends SpotifyPlaybackCommandInput {
  target: string;
}

interface SpotifyImageSet {
  sources?: SpotifyImageSource[];
}

interface SpotifyArtistRef {
  id?: string;
  uri?: string;
  profile?: {
    name?: string;
    biography?: {
      text?: string;
    };
    externalLinks?: {
      items?: Array<{
        name?: string;
        url?: string;
      }>;
    };
  };
  stats?: {
    monthlyListeners?: number;
  };
  visuals?: {
    avatarImage?: SpotifyImageSet;
  };
}

interface SpotifyTrackCore {
  id?: string;
  uri?: string;
  name?: string;
  trackNumber?: number;
  duration?: {
    totalMilliseconds?: number;
  };
  artists?: {
    items?: SpotifyArtistRef[];
  };
  albumOfTrack?: {
    name?: string;
    uri?: string;
    coverArt?: SpotifyImageSet;
  };
}

interface SpotifyAlbumEntity {
  id?: string;
  uri?: string;
  name?: string;
  label?: string;
  type?: string;
  date?: {
    year?: number;
    month?: number;
    day?: number;
  };
  coverArt?: SpotifyImageSet;
  artists?: {
    items?: SpotifyArtistRef[];
  };
  tracks?: {
    items?: Array<{
      track?: SpotifyTrackCore;
    }>;
  };
  tracksV2?: {
    items?: Array<{
      track?: SpotifyTrackCore;
    }>;
  };
  trackListStats?: {
    numberOfItems?: number;
  };
}

interface SpotifyTrackEntity {
  id?: string;
  uri?: string;
  name?: string;
  duration?: {
    totalMilliseconds?: number;
  };
  albumOfTrack?: SpotifyAlbumEntity;
}

interface SpotifyArtistEntity {
  uri?: string;
  profile?: {
    name?: string;
    biography?: {
      text?: string;
    };
    externalLinks?: {
      items?: Array<{
        name?: string;
        url?: string;
      }>;
    };
  };
  stats?: {
    followers?: number;
    monthlyListeners?: number;
  };
  visuals?: {
    avatarImage?: SpotifyImageSet;
  };
  discography?: {
    topTracks?: {
      items?: Array<{
        track?: SpotifyTrackCore;
      }>;
    };
  };
}

interface SpotifyPlaylistEntity {
  id?: string;
  uri?: string;
  name?: string;
  description?: string;
  followers?: number;
  images?: {
    items?: Array<{
      sources?: SpotifyImageSource[];
    }>;
  };
  ownerV2?: {
    data?: {
      name?: string;
      username?: string;
      uri?: string;
      avatar?: SpotifyImageSet;
    };
  };
  content?: {
    items?: Array<{
      itemV2?: {
        data?: SpotifyTrackCore;
      };
    }>;
  };
}

interface SpotifyInitialState {
  entities?: {
    items?: Record<string, unknown>;
  };
}

interface SpotifySearchResponse {
  tracks?: {
    items?: Array<{
      id?: string;
      name?: string;
      duration_ms?: number;
      artists?: Array<{
        name?: string;
      }>;
      album?: {
        name?: string;
        images?: Array<{
          url?: string;
        }>;
      };
      external_urls?: {
        spotify?: string;
      };
    }>;
  };
  albums?: {
    items?: Array<{
      id?: string;
      name?: string;
      total_tracks?: number;
      release_date?: string;
      artists?: Array<{
        name?: string;
      }>;
      images?: Array<{
        url?: string;
      }>;
      external_urls?: {
        spotify?: string;
      };
    }>;
  };
  artists?: {
    items?: Array<{
      id?: string;
      name?: string;
      followers?: {
        total?: number;
      };
      external_urls?: {
        spotify?: string;
      };
      images?: Array<{
        url?: string;
      }>;
    }>;
  };
  playlists?: {
    items?: Array<{
      id?: string;
      name?: string;
      description?: string;
      tracks?: {
        total?: number;
      };
      owner?: {
        display_name?: string;
      };
      external_urls?: {
        spotify?: string;
      };
      images?: Array<{
        url?: string;
      }>;
    }>;
  };
}

interface SpotifyApiArtist {
  name?: string;
  uri?: string;
  external_urls?: {
    spotify?: string;
  };
}

interface SpotifyApiAlbum {
  name?: string;
  uri?: string;
  external_urls?: {
    spotify?: string;
  };
}

interface SpotifyApiTrack {
  id?: string;
  name?: string;
  uri?: string;
  type?: string;
  duration_ms?: number;
  artists?: SpotifyApiArtist[];
  album?: SpotifyApiAlbum;
  external_urls?: {
    spotify?: string;
  };
}

interface SpotifyPlaybackDevice {
  id?: string;
  is_active?: boolean;
  is_private_session?: boolean;
  is_restricted?: boolean;
  name?: string;
  type?: string;
  volume_percent?: number | null;
  supports_volume?: boolean;
}

interface SpotifyDevicesResponse {
  devices?: SpotifyPlaybackDevice[];
}

interface SpotifyPlaybackContext {
  uri?: string;
  type?: string;
  external_urls?: {
    spotify?: string;
  };
}

interface SpotifyPlaybackStateResponse {
  device?: SpotifyPlaybackDevice;
  repeat_state?: string;
  shuffle_state?: boolean;
  progress_ms?: number;
  is_playing?: boolean;
  currently_playing_type?: string;
  item?: SpotifyApiTrack;
  context?: SpotifyPlaybackContext;
}

interface SpotifyQueueResponse {
  currently_playing?: SpotifyApiTrack;
  queue?: SpotifyApiTrack[];
}

interface SpotifyPagingResponse<T> {
  href?: string;
  limit?: number;
  next?: string | null;
  offset?: number;
  previous?: string | null;
  total?: number;
  items?: T[];
}

interface SpotifyPlayHistoryItem {
  played_at?: string;
  track?: SpotifyApiTrack;
}

interface SpotifySavedTrackItem {
  added_at?: string;
  track?: SpotifyApiTrack;
}

interface SpotifyPlaylistSummary {
  id?: string;
  name?: string;
  description?: string;
  collaborative?: boolean;
  public?: boolean | null;
  tracks?: {
    total?: number;
  };
  owner?: {
    display_name?: string;
  };
  external_urls?: {
    spotify?: string;
  };
}

interface SpotifyPlaylistCreateResponse extends SpotifyPlaylistSummary {
  external_urls?: {
    spotify?: string;
  };
}

interface SpotifyPlaylistTrackItem {
  added_at?: string;
  track?: SpotifyApiTrack;
}

interface SpotifyUserTopArtist {
  id?: string;
  name?: string;
  followers?: {
    total?: number;
  };
  external_urls?: {
    spotify?: string;
  };
}

export class SpotifyAdapter extends BasePlatformAdapter {
  readonly platform = "spotify" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const provisionalSession = {
      version: 1 as const,
      platform: this.platform,
      account: input.account ?? "default",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: imported.source,
      status: { state: "unknown" as const },
      cookieJar: serializeCookieJar(imported.jar),
    };

    const probe = await this.probeSession(provisionalSession);
    const account = input.account ?? probe.user?.username ?? probe.user?.id ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Spotify session has expired.", {
        details: {
          platform: this.platform,
          account,
          sessionPath,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message:
        probe.status.state === "active"
          ? `Saved Spotify session for ${account}.`
          : `Saved Spotify session for ${account}, but token verification should be rechecked before write actions.`,
      user: probe.user,
      sessionPath,
      data: {
        status: probe.status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.prepareSession(account);
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);
    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: probe.status,
      user: probe.user ?? session.user,
    });
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "Spotify does not support media posting from this CLI. Use library and follow actions instead.",
      {
        details: {
          platform: this.platform,
          account: session.account,
          mediaPath: input.mediaPath,
        },
      },
    );
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "Spotify does not support text posting from this CLI. Use library and follow actions instead.",
      {
        details: {
          platform: this.platform,
          account: session.account,
          textLength: input.text.length,
        },
      },
    );
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseSpotifyTrackTarget(input.target);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);

    await this.requestApi<void>(client, accessToken, `/me/tracks?ids=${encodeURIComponent(target.trackId)}`, {
      method: "PUT",
      expectedStatus: [200, 201, 202, 204],
      responseType: "text",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `Saved Spotify track ${target.trackId} to your library.`,
      id: target.trackId,
      url: target.url ?? buildSpotifyEntityUrl("track", target.trackId),
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    throw new AutoCliError("UNSUPPORTED_ACTION", "Spotify does not expose comments in the web player flow used by this CLI.", {
      details: {
        platform: this.platform,
        account: session.account,
        target: input.target,
      },
    });
  }

  async unlike(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseSpotifyTrackTarget(input.target);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);

    await this.requestApi<void>(client, accessToken, `/me/tracks?ids=${encodeURIComponent(target.trackId)}`, {
      method: "DELETE",
      expectedStatus: [200, 202, 204],
      responseType: "text",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unlike",
      message: `Removed Spotify track ${target.trackId} from your library.`,
      id: target.trackId,
      url: target.url ?? buildSpotifyEntityUrl("track", target.trackId),
    };
  }

  async me(input: SpotifyAuthInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);
    const profile = await this.requestApi<SpotifyMeResponse>(client, accessToken, "/me");
    const user = this.toSessionUser(profile);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "me",
      message: `Loaded Spotify profile for ${user.displayName ?? user.username ?? session.account}.`,
      user,
      data: {
        id: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        country: profile.country,
        product: profile.product,
        profileUrl: profile.external_urls?.spotify,
      },
    };
  }

  async search(input: SpotifySearchInput): Promise<AdapterActionResult> {
    const limit = input.limit ?? 5;
    const type = input.type ?? "track";

    try {
      const { session, connect } = await this.createConnectContext(input.account);
      const response = await connect.search(type, input.query, limit, 0);

      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "search",
        message: `Spotify search returned ${response.items.length} ${type} result${response.items.length === 1 ? "" : "s"}.`,
        data: {
          query: input.query,
          type,
          limit,
          total: response.total,
          engine: "connect",
          results: response.items,
        },
      };
    } catch (error) {
      if (!this.shouldFallbackSpotifySearch(error)) {
        throw error;
      }
    }

    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const query = new URLSearchParams({
      q: input.query,
      type,
      limit: String(limit),
    });
    const response = await this.requestApi<SpotifySearchResponse>(client, accessToken, `/search?${query.toString()}`);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "search",
      message: `Spotify search returned ${this.countSearchResults(response, type)} ${type} result${this.countSearchResults(response, type) === 1 ? "" : "s"}.`,
      data: {
        query: input.query,
        type,
        limit,
        engine: "web",
        results: this.normalizeSearchResults(response, type),
      },
    };
  }

  async recent(input: SpotifyListInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const limit = input.limit ?? 10;
    const params = new URLSearchParams({
      limit: String(limit),
    });
    const response = await this.requestApi<{ items?: SpotifyPlayHistoryItem[] }>(
      client,
      accessToken,
      `/me/player/recently-played?${params.toString()}`,
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "recent",
      message: `Loaded ${response.items?.length ?? 0} recently played Spotify track${response.items?.length === 1 ? "" : "s"}.`,
      data: {
        items: (response.items ?? []).map((item) => ({
          ...this.normalizeTrack(item.track),
          playedAt: item.played_at,
        })),
      },
    };
  }

  async top(input: SpotifyTopInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const limit = input.limit ?? 10;
    const range = input.range ?? "medium_term";
    const params = new URLSearchParams({
      limit: String(limit),
      time_range: range,
    });

    if (input.type === "tracks") {
      const response = await this.requestApi<{ items?: SpotifyApiTrack[] }>(client, accessToken, `/me/top/tracks?${params.toString()}`);
      return {
        ok: true,
        platform: this.platform,
        account: session.account,
        action: "top",
        message: `Loaded ${response.items?.length ?? 0} top Spotify tracks.`,
        data: {
          type: input.type,
          range,
          items: (response.items ?? []).map((track) => this.normalizeTrack(track)),
        },
      };
    }

    const response = await this.requestApi<{ items?: SpotifyUserTopArtist[] }>(client, accessToken, `/me/top/artists?${params.toString()}`);
    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "top",
      message: `Loaded ${response.items?.length ?? 0} top Spotify artists.`,
      data: {
        type: input.type,
        range,
        items: (response.items ?? []).map((artist) => ({
          id: artist.id,
          title: artist.name,
          subtitle:
            typeof artist.followers?.total === "number" ? `${artist.followers.total.toLocaleString("en-US")} followers` : undefined,
          url: artist.external_urls?.spotify,
        })),
      },
    };
  }

  async savedTracks(input: SpotifyListInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const limit = input.limit ?? 10;
    const offset = input.offset ?? 0;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const response = await this.requestApi<SpotifyPagingResponse<SpotifySavedTrackItem>>(
      client,
      accessToken,
      `/me/tracks?${params.toString()}`,
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "savedtracks",
      message: `Loaded ${response.items?.length ?? 0} saved Spotify track${response.items?.length === 1 ? "" : "s"}.`,
      data: {
        limit,
        offset,
        total: response.total,
        items: (response.items ?? []).map((item) => ({
          ...this.normalizeTrack(item.track),
          addedAt: item.added_at,
        })),
      },
    };
  }

  async playlists(input: SpotifyListInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const limit = input.limit ?? 10;
    const offset = input.offset ?? 0;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const response = await this.requestApi<SpotifyPagingResponse<SpotifyPlaylistSummary>>(
      client,
      accessToken,
      `/me/playlists?${params.toString()}`,
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "playlists",
      message: `Loaded ${response.items?.length ?? 0} Spotify playlist${response.items?.length === 1 ? "" : "s"}.`,
      data: {
        limit,
        offset,
        total: response.total,
        items: (response.items ?? []).map((playlist) => this.normalizePlaylistSummary(playlist)),
      },
    };
  }

  async playlistCreate(input: SpotifyPlaylistCreateInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const profile = await this.requestApi<SpotifyMeResponse>(client, accessToken, "/me");
    if (!profile.id) {
      throw new AutoCliError("SPOTIFY_PROFILE_UNAVAILABLE", "Spotify profile id is required to create playlists.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    const response = await this.requestApi<SpotifyPlaylistCreateResponse>(client, accessToken, `/users/${encodeURIComponent(profile.id)}/playlists`, {
      method: "POST",
      expectedStatus: 201,
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? "",
        public: Boolean(input.public),
        collaborative: Boolean(input.collaborative),
      }),
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "playlistcreate",
      message: `Created Spotify playlist ${response.name ?? input.name}.`,
      id: response.id,
      url: response.external_urls?.spotify,
      data: this.normalizePlaylistSummary(response),
    };
  }

  async playlistTracks(input: SpotifyPlaylistTracksInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const playlist = parseSpotifyPlaylistTarget(input.target);
    const limit = input.limit ?? 10;
    const offset = input.offset ?? 0;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const response = await this.requestApi<SpotifyPagingResponse<SpotifyPlaylistTrackItem>>(
      client,
      accessToken,
      `/playlists/${encodeURIComponent(playlist.playlistId)}/tracks?${params.toString()}`,
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "playlisttracks",
      message: `Loaded ${response.items?.length ?? 0} track${response.items?.length === 1 ? "" : "s"} from Spotify playlist ${playlist.playlistId}.`,
      id: playlist.playlistId,
      url: playlist.url ?? spotifyUriToUrl(playlist.uri) ?? buildSpotifyEntityUrl("playlist", playlist.playlistId),
      data: {
        limit,
        offset,
        total: response.total,
        items: (response.items ?? []).map((item) => ({
          ...this.normalizeTrack(item.track),
          addedAt: item.added_at,
        })),
      },
    };
  }

  async playlistAdd(input: SpotifyPlaylistMutationInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const playlist = parseSpotifyPlaylistTarget(input.playlist);
    const uris = input.targets.map((target) => {
      const parsed = parseSpotifyTrackTarget(target);
      return `spotify:track:${parsed.trackId}`;
    });

    if (uris.length === 0) {
      throw new AutoCliError("INVALID_TARGET", "Provide at least one Spotify track target to add.", {
        details: {
          platform: this.platform,
          playlist: input.playlist,
        },
      });
    }

    await this.requestApi<{ snapshot_id?: string }>(
      client,
      accessToken,
      `/playlists/${encodeURIComponent(playlist.playlistId)}/tracks`,
      {
        method: "POST",
        expectedStatus: [201, 200],
        body: JSON.stringify({ uris }),
      },
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "playlistadd",
      message: `Added ${uris.length} track${uris.length === 1 ? "" : "s"} to Spotify playlist ${playlist.playlistId}.`,
      id: playlist.playlistId,
      url: playlist.url ?? spotifyUriToUrl(playlist.uri) ?? buildSpotifyEntityUrl("playlist", playlist.playlistId),
      data: {
        added: uris.length,
      },
    };
  }

  async playlistRemove(input: SpotifyPlaylistMutationInput): Promise<AdapterActionResult> {
    const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
    const playlist = parseSpotifyPlaylistTarget(input.playlist);
    const tracks = input.targets.map((target) => {
      const parsed = parseSpotifyTrackTarget(target);
      return { uri: `spotify:track:${parsed.trackId}` };
    });

    if (tracks.length === 0) {
      throw new AutoCliError("INVALID_TARGET", "Provide at least one Spotify track target to remove.", {
        details: {
          platform: this.platform,
          playlist: input.playlist,
        },
      });
    }

    await this.requestApi<{ snapshot_id?: string }>(
      client,
      accessToken,
      `/playlists/${encodeURIComponent(playlist.playlistId)}/tracks`,
      {
        method: "DELETE",
        expectedStatus: [200, 201],
        body: JSON.stringify({ tracks }),
      },
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "playlistremove",
      message: `Removed ${tracks.length} track${tracks.length === 1 ? "" : "s"} from Spotify playlist ${playlist.playlistId}.`,
      id: playlist.playlistId,
      url: playlist.url ?? spotifyUriToUrl(playlist.uri) ?? buildSpotifyEntityUrl("playlist", playlist.playlistId),
      data: {
        removed: tracks.length,
      },
    };
  }

  async trackInfo(input: SpotifyEntityInput): Promise<AdapterActionResult> {
    const target = parseSpotifyTrackTarget(input.target);
    const entity = await this.loadPublicEntity<SpotifyTrackEntity>("track", target.trackId);
    const coreTrack =
      entity.albumOfTrack?.tracks?.items?.find((item) => item.track?.id === target.trackId)?.track ?? undefined;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "trackid",
      message: `Loaded Spotify track ${coreTrack?.name ?? entity.name ?? target.trackId}.`,
      id: target.trackId,
      url: target.url ?? spotifyUriToUrl(target.uri) ?? buildSpotifyEntityUrl("track", target.trackId),
      data: {
        id: target.trackId,
        title: coreTrack?.name ?? entity.name,
        artists: this.joinArtistNames(coreTrack?.artists?.items),
        album: entity.albumOfTrack?.name,
        albumUrl: spotifyUriToUrl(entity.albumOfTrack?.uri),
        duration: formatSpotifyDuration(coreTrack?.duration?.totalMilliseconds ?? entity.duration?.totalMilliseconds),
        releaseDate: formatSpotifyDate(entity.albumOfTrack?.date),
        coverUrl: pickSpotifyImageUrl(entity.albumOfTrack?.coverArt?.sources),
        trackNumber: coreTrack?.trackNumber,
      },
    };
  }

  async albumInfo(input: SpotifyEntityInput): Promise<AdapterActionResult> {
    const target = parseSpotifyAlbumTarget(input.target);
    const entity = await this.loadPublicEntity<SpotifyAlbumEntity>("album", target.albumId);
    const limit = input.limit ?? 10;
    const albumTracks = entity.tracksV2?.items ?? entity.tracks?.items ?? [];
    const tracks = albumTracks.slice(0, limit).map((item) => ({
      id: item.track?.id,
      title: item.track?.name,
      duration: formatSpotifyDuration(item.track?.duration?.totalMilliseconds),
      url: item.track?.id ? buildSpotifyEntityUrl("track", item.track.id) : undefined,
    }));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "albumid",
      message: `Loaded Spotify album ${entity.name ?? target.albumId}.`,
      id: target.albumId,
      url: target.url ?? buildSpotifyEntityUrl("album", target.albumId),
      data: {
        id: target.albumId,
        title: entity.name,
        artists: this.joinArtistNames(entity.artists?.items),
        releaseDate: formatSpotifyDate(entity.date),
        totalTracks:
          typeof entity.trackListStats?.numberOfItems === "number"
            ? String(entity.trackListStats.numberOfItems)
            : String(albumTracks.length),
        label: cleanSpotifyText(entity.label),
        coverUrl: pickSpotifyImageUrl(entity.coverArt?.sources),
        tracks,
      },
    };
  }

  async artistInfo(input: SpotifyEntityInput): Promise<AdapterActionResult> {
    const target = parseSpotifyArtistTarget(input.target);
    const entity = await this.loadPublicEntity<SpotifyArtistEntity>("artist", target.artistId);
    const limit = input.limit ?? 5;
    const topTracks = (entity.discography?.topTracks?.items ?? []).slice(0, limit).map((item) => ({
      id: item.track?.id,
      title: item.track?.name,
      album: item.track?.albumOfTrack?.name,
      duration: formatSpotifyDuration(item.track?.duration?.totalMilliseconds),
      url: item.track?.id ? buildSpotifyEntityUrl("track", item.track.id) : undefined,
    }));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "artistid",
      message: `Loaded Spotify artist ${entity.profile?.name ?? target.artistId}.`,
      id: target.artistId,
      url: target.url ?? buildSpotifyEntityUrl("artist", target.artistId),
      data: {
        id: target.artistId,
        title: entity.profile?.name,
        biography: cleanSpotifyText(entity.profile?.biography?.text),
        followers:
          typeof entity.stats?.followers === "number" ? `${entity.stats.followers.toLocaleString("en-US")} followers` : undefined,
        monthlyListeners:
          typeof entity.stats?.monthlyListeners === "number"
            ? `${entity.stats.monthlyListeners.toLocaleString("en-US")} monthly listeners`
            : undefined,
        avatarUrl: pickSpotifyImageUrl(entity.visuals?.avatarImage?.sources),
        topTracks,
      },
    };
  }

  async playlistInfo(input: SpotifyEntityInput): Promise<AdapterActionResult> {
    const target = parseSpotifyPlaylistTarget(input.target);
    const entity = await this.loadPublicEntity<SpotifyPlaylistEntity>("playlist", target.playlistId);
    const limit = input.limit ?? 10;
    const tracks = (entity.content?.items ?? []).slice(0, limit).map((item) => ({
      id: item.itemV2?.data?.id,
      title: item.itemV2?.data?.name,
      artists: this.joinArtistNames(item.itemV2?.data?.artists?.items),
      album: item.itemV2?.data?.albumOfTrack?.name,
      duration: formatSpotifyDuration(item.itemV2?.data?.duration?.totalMilliseconds),
      url: item.itemV2?.data?.id ? buildSpotifyEntityUrl("track", item.itemV2.data.id) : undefined,
    }));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "playlistid",
      message: `Loaded Spotify playlist ${entity.name ?? target.playlistId}.`,
      id: target.playlistId,
      url: target.url ?? buildSpotifyEntityUrl("playlist", target.playlistId),
      data: {
        id: target.playlistId,
        title: entity.name,
        owner: entity.ownerV2?.data?.name ?? entity.ownerV2?.data?.username,
        followers: typeof entity.followers === "number" ? `${entity.followers.toLocaleString("en-US")} followers` : undefined,
        totalTracks: String(entity.content?.items?.length ?? 0),
        description: cleanSpotifyText(entity.description),
        coverUrl: pickSpotifyImageUrl(entity.images?.items?.[0]?.sources),
        tracks,
      },
    };
  }

  async followArtist(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseSpotifyArtistTarget(input.target);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);

    await this.requestApi<void>(client, accessToken, `/me/following?type=artist&ids=${encodeURIComponent(target.artistId)}`, {
      method: "PUT",
      expectedStatus: [200, 202, 204],
      responseType: "text",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "followartist",
      message: `Followed Spotify artist ${target.artistId}.`,
      id: target.artistId,
      url: target.url ?? buildSpotifyEntityUrl("artist", target.artistId),
    };
  }

  async unfollowArtist(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseSpotifyArtistTarget(input.target);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);

    await this.requestApi<void>(client, accessToken, `/me/following?type=artist&ids=${encodeURIComponent(target.artistId)}`, {
      method: "DELETE",
      expectedStatus: [200, 202, 204],
      responseType: "text",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unfollowartist",
      message: `Unfollowed Spotify artist ${target.artistId}.`,
      id: target.artistId,
      url: target.url ?? buildSpotifyEntityUrl("artist", target.artistId),
    };
  }

  async followPlaylist(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseSpotifyPlaylistTarget(input.target);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);

    await this.requestApi<void>(client, accessToken, `/playlists/${encodeURIComponent(target.playlistId)}/followers`, {
      method: "PUT",
      expectedStatus: [200, 202, 204],
      responseType: "text",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "followplaylist",
      message: `Followed Spotify playlist ${target.playlistId}.`,
      id: target.playlistId,
      url: target.url ?? buildSpotifyEntityUrl("playlist", target.playlistId),
    };
  }

  async unfollowPlaylist(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.ensureSavedSession(input.account);
    const target = parseSpotifyPlaylistTarget(input.target);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);

    await this.requestApi<void>(client, accessToken, `/playlists/${encodeURIComponent(target.playlistId)}/followers`, {
      method: "DELETE",
      expectedStatus: [200, 202, 204],
      responseType: "text",
    });

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unfollowplaylist",
      message: `Unfollowed Spotify playlist ${target.playlistId}.`,
      id: target.playlistId,
      url: target.url ?? buildSpotifyEntityUrl("playlist", target.playlistId),
    };
  }

  async devices(input: SpotifyPlaybackStatusInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        return {
          session,
          devices: await connect.devices(),
        };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        return {
          session,
          devices: (await this.listDevices(client, accessToken)).map((device) => this.normalizeDevice(device)),
        };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "devices",
      message: `Loaded ${result.devices.length} Spotify device${result.devices.length === 1 ? "" : "s"}.`,
      data: {
        devices: result.devices,
      },
    }, engine);
  }

  async playbackStatus(input: SpotifyPlaybackStatusInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        return {
          session,
          playback: await connect.status(),
        };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const playback = await this.requestApi<SpotifyPlaybackStateResponse>(client, accessToken, "/me/player", {
          expectedStatus: [200, 204],
        });

        return {
          session,
          playback: this.normalizePlaybackState(playback),
        };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "status",
      message: result.playback.title ? `Loaded Spotify playback status for ${result.playback.title}.` : "No active Spotify playback was found.",
      data: result.playback,
    }, engine);
  }

  async transferPlayback(input: SpotifyTransferInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        return {
          session,
          device: await connect.transfer(input.target),
        };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const device = await this.resolveDevice(client, accessToken, input.target);

        await this.requestApi<void>(client, accessToken, "/me/player", {
          method: "PUT",
          expectedStatus: [202, 204],
          responseType: "text",
          body: JSON.stringify({
            device_ids: [device.id],
            play: Boolean(input.play),
          }),
        });

        return {
          session,
          device: this.normalizeDevice(device),
        };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "device",
      message: `Transferred Spotify playback to ${result.device.name ?? result.device.id}.`,
      id: result.device.id,
      data: {
        device: result.device,
        play: Boolean(input.play),
      },
    }, engine);
  }

  async play(input: SpotifyPlayInput): Promise<AdapterActionResult> {
    const parsedTarget = input.target
      ? parseSpotifyEntityTarget(
          input.target,
          input.type ? [input.type] : (["track", "album", "artist", "playlist"] as const),
        )
      : undefined;

    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.play(parsedTarget ? { type: parsedTarget.type, id: parsedTarget.id } : undefined);
        return {
          session,
          deviceId: undefined,
        };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams();
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        let body: string | undefined;
        if (parsedTarget) {
          const uri = `spotify:${parsedTarget.type}:${parsedTarget.id}`;
          body = parsedTarget.type === "track" ? JSON.stringify({ uris: [uri] }) : JSON.stringify({ context_uri: uri });
        }

        await this.requestApi<void>(client, accessToken, `/me/player/play${this.toQuerySuffix(params)}`, {
          method: "PUT",
          expectedStatus: [202, 204],
          responseType: "text",
          body,
        });

        return {
          session,
          deviceId,
        };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "play",
      message: parsedTarget ? `Started Spotify ${parsedTarget.type} ${parsedTarget.id}.` : "Resumed Spotify playback.",
      id: parsedTarget?.id,
      url: parsedTarget ? parsedTarget.url ?? spotifyUriToUrl(parsedTarget.uri) ?? buildSpotifyEntityUrl(parsedTarget.type, parsedTarget.id) : undefined,
      data: {
        deviceId: result.deviceId,
      },
    }, engine);
  }

  async pause(input: SpotifyPlaybackCommandInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.pause();
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams();
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/pause${this.toQuerySuffix(params)}`, {
          method: "PUT",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "pause",
      message: "Paused Spotify playback.",
      data: {
        deviceId: result.deviceId,
      },
    }, engine);
  }

  async next(input: SpotifyPlaybackCommandInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.next();
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams();
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/next${this.toQuerySuffix(params)}`, {
          method: "POST",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "next",
      message: "Skipped to the next Spotify track.",
      data: {
        deviceId: result.deviceId,
      },
    }, engine);
  }

  async previous(input: SpotifyPlaybackCommandInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.previous();
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams();
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/previous${this.toQuerySuffix(params)}`, {
          method: "POST",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "previous",
      message: "Moved to the previous Spotify track.",
      data: {
        deviceId: result.deviceId,
      },
    }, engine);
  }

  async seek(input: SpotifySeekInput): Promise<AdapterActionResult> {
    const positionMs = parseSpotifyPositionValue(input.position);
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.seek(positionMs);
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams({
          position_ms: String(positionMs),
        });
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/seek${this.toQuerySuffix(params)}`, {
          method: "PUT",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "seek",
      message: `Moved Spotify playback to ${input.position}.`,
      data: {
        deviceId: result.deviceId,
        positionMs,
      },
    }, engine);
  }

  async volume(input: SpotifyVolumeInput): Promise<AdapterActionResult> {
    const volumePercent = parseSpotifyPercentValue(input.percent);
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.volume(volumePercent);
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams({
          volume_percent: String(volumePercent),
        });
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/volume${this.toQuerySuffix(params)}`, {
          method: "PUT",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "volume",
      message: `Set Spotify volume to ${volumePercent}%.`,
      data: {
        deviceId: result.deviceId,
        volumePercent,
      },
    }, engine);
  }

  async shuffle(input: SpotifyShuffleInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.shuffle(input.state);
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams({
          state: String(input.state),
        });
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/shuffle${this.toQuerySuffix(params)}`, {
          method: "PUT",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "shuffle",
      message: `Turned Spotify shuffle ${input.state ? "on" : "off"}.`,
      data: {
        deviceId: result.deviceId,
        state: input.state,
      },
    }, engine);
  }

  async repeat(input: SpotifyRepeatInput): Promise<AdapterActionResult> {
    const state = parseSpotifyRepeatState(input.state);
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.repeat(state);
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams({
          state,
        });
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/repeat${this.toQuerySuffix(params)}`, {
          method: "PUT",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "repeat",
      message: `Set Spotify repeat mode to ${state}.`,
      data: {
        deviceId: result.deviceId,
        state,
      },
    }, engine);
  }

  async queue(input: SpotifyPlaybackStatusInput): Promise<AdapterActionResult> {
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        return {
          session,
          queue: await connect.queue(),
        };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const response = await this.requestApi<SpotifyQueueResponse>(client, accessToken, "/me/player/queue");
        return {
          session,
          queue: {
            current: this.normalizeTrack(response.currently_playing),
            queue: (response.queue ?? [])
              .map((track) => this.normalizeTrack(track))
              .filter((track): track is SpotifyConnectTrackSummary => Boolean(track)),
          },
        };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "queue",
      message: `Loaded Spotify queue with ${result.queue.queue.length} upcoming track${result.queue.queue.length === 1 ? "" : "s"}.`,
      data: result.queue,
    }, engine);
  }

  async queueAdd(input: SpotifyQueueAddInput): Promise<AdapterActionResult> {
    const target = parseSpotifyTrackTarget(input.target);
    const { engine, result } = await this.runSpotifyPlaybackEngine(input.engine, {
      connect: async () => {
        const { session, connect } = await this.createConnectContext(input.account);
        if (input.device) {
          await connect.transfer(input.device);
        }
        await connect.queueAdd(target.trackId);
        return { session, deviceId: undefined };
      },
      web: async () => {
        const { session, client, accessToken } = await this.createAuthorizedContext(input.account);
        const deviceId = await this.resolveOptionalDeviceId(client, accessToken, input.device);
        const params = new URLSearchParams({
          uri: `spotify:track:${target.trackId}`,
        });
        if (deviceId) {
          params.set("device_id", deviceId);
        }

        await this.requestApi<void>(client, accessToken, `/me/player/queue${this.toQuerySuffix(params)}`, {
          method: "POST",
          expectedStatus: [202, 204],
          responseType: "text",
        });

        return { session, deviceId };
      },
    });

    return this.withEngine({
      ok: true,
      platform: this.platform,
      account: result.session.account,
      action: "queueadd",
      message: `Queued Spotify track ${target.trackId}.`,
      id: target.trackId,
      url: target.url ?? spotifyUriToUrl(target.uri) ?? buildSpotifyEntityUrl("track", target.trackId),
      data: {
        deviceId: result.deviceId,
      },
    }, engine);
  }

  private async ensureSavedSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.prepareSession(account);
    const probe = await this.probeSession(loaded.session);
    const nextSession = await this.persistExistingSession(loaded.session, {
      user: probe.user ?? loaded.session.user,
      status: probe.status,
      metadata: {
        ...(loaded.session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Spotify session has expired.", {
        details: {
          platform: this.platform,
          account: loaded.session.account,
          sessionPath: loaded.path,
        },
      });
    }

    return {
      path: loaded.path,
      session: nextSession,
    };
  }

  private async prepareSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    return {
      path: loaded.path,
      session: await this.maybeAutoRefresh(loaded.session),
    };
  }

  private async maybeAutoRefresh(session: PlatformSession): Promise<PlatformSession> {
    const client = await this.createSpotifyClient(session);
    const refresh = await maybeAutoRefreshSession({
      platform: this.platform,
      session,
      jar: client.jar,
      strategy: "homepage_keepalive",
      capability: "auto",
      refresh: async () => {
        await client.request<string>(SPOTIFY_HOME, {
          responseType: "text",
          expectedStatus: 200,
        });
      },
    });

    return this.persistExistingSession(session, {
      jar: client.jar,
      metadata: {
        ...(session.metadata ?? {}),
        ...refresh.metadata,
      },
    });
  }

  private async persistSessionState(session: PlatformSession, probe: SpotifyProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async probeSession(session: PlatformSession): Promise<SpotifyProbe> {
    const client = await this.createSpotifyClient(session);
    const importantCookies = await Promise.all([
      client.getCookieValue("sp_dc", SPOTIFY_HOME),
      client.getCookieValue("sp_key", SPOTIFY_HOME),
    ]);

    if (!importantCookies[0] || !importantCookies[1]) {
      return {
        status: {
          state: "expired",
          message: "Missing required Spotify auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const html = await client.request<string>(SPOTIFY_HOME, {
        responseType: "text",
        expectedStatus: 200,
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      const config = extractSpotifyScriptPayload<SpotifyAppServerConfig>(html, "appServerConfig");

      if (config.isAnonymous === true) {
        return {
          status: {
            state: "expired",
            message: "Spotify returned a signed-out homepage. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "LOGGED_OUT",
          },
        };
      }

      try {
        const token = await this.resolveAccessToken(client, session.account);

        try {
          const profile = await this.requestApi<SpotifyMeResponse>(client, token, "/me");
          return {
            status: {
              state: "active",
              message: "Session validated via the Spotify homepage and Web API.",
              lastValidatedAt: new Date().toISOString(),
            },
            user: this.toSessionUser(profile),
            metadata: {
              market: config.market,
              locale: config.locale?.locale,
              premium: config.isPremium,
              clientVersion: config.clientVersion,
              buildDate: config.buildDate,
              tokenExpiresAt: token.accessTokenExpirationTimestampMs
                ? new Date(token.accessTokenExpirationTimestampMs).toISOString()
                : undefined,
              country: profile.country,
              product: profile.product,
              validation: "homepage_and_api",
            },
          };
        } catch (error) {
          return {
            status: {
              state: "active",
              message:
                this.extractHttpStatus(error) === 429
                  ? "Session validated via the Spotify homepage and token bootstrap, but Spotify rate-limited the profile check."
                  : "Session validated via the Spotify homepage and token bootstrap, but the Web API profile check failed.",
              lastValidatedAt: new Date().toISOString(),
              lastErrorCode: isAutoCliError(error) ? error.code : undefined,
            },
            metadata: {
              market: config.market,
              locale: config.locale?.locale,
              premium: config.isPremium,
              clientVersion: config.clientVersion,
              buildDate: config.buildDate,
              tokenExpiresAt: token.accessTokenExpirationTimestampMs
                ? new Date(token.accessTokenExpirationTimestampMs).toISOString()
                : undefined,
              validation: "homepage_and_token",
              apiStatus: this.extractHttpStatus(error),
            },
          };
        }
      } catch {
        return {
          status: {
            state: "active",
            message: "Session validated via the Spotify homepage, but access token resolution could not complete.",
            lastValidatedAt: new Date().toISOString(),
          },
          metadata: {
            market: config.market,
            locale: config.locale?.locale,
            premium: config.isPremium,
            clientVersion: config.clientVersion,
            buildDate: config.buildDate,
            validation: "homepage_only",
          },
        };
      }
    } catch {
      return {
        status: {
          state: "unknown",
          message: "Spotify auth cookies are present, but homepage validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
      };
    }
  }

  private async createSpotifyClient(session: PlatformSession) {
    return this.createClient(session, {
      origin: SPOTIFY_ORIGIN,
      referer: SPOTIFY_HOME,
      "user-agent": SPOTIFY_USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    });
  }

  private async resolveAccessToken(
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
    account?: string,
  ): Promise<SpotifyTokenResponse & { accessToken: string }> {
    const serverTimeSeconds = await this.resolveServerTime(client);
    const cookie = await client.jar.getCookieString(SPOTIFY_HOME);
    let lastError: unknown;

    for (const reason of ["transport", "init"] as const) {
      for (const candidate of getSpotifyTokenSecretCandidates()) {
        try {
          const params = buildSpotifyTokenQueryParameters(
            {
              reason,
              productType: "web-player",
              serverTimeSeconds,
            },
            candidate,
          );
          const token = await client.request<SpotifyTokenResponse>(`${SPOTIFY_TOKEN_ENDPOINT}?${params.toString()}`, {
            expectedStatus: 200,
            headers: {
              accept: "application/json,text/plain,*/*",
              cookie,
              origin: SPOTIFY_ORIGIN,
              referer: SPOTIFY_HOME,
            },
          });

          if (typeof token.accessToken === "string" && token.accessToken.length > 0) {
            return token as SpotifyTokenResponse & { accessToken: string };
          }
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw new AutoCliError(
      "SPOTIFY_ACCESS_TOKEN_UNAVAILABLE",
      "Spotify access token resolution failed for this saved session. Re-import fresh cookies from a logged-in browser session.",
      {
        cause: lastError,
        details: {
          platform: this.platform,
          account,
        },
      },
    );
  }

  private async resolveServerTime(
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
  ): Promise<number | undefined> {
    try {
      const cookie = await client.jar.getCookieString(SPOTIFY_HOME);
      const response = await client.request<SpotifyServerTimeResponse>(SPOTIFY_SERVER_TIME_ENDPOINT, {
        expectedStatus: 200,
        headers: {
          accept: "application/json,text/plain,*/*",
          cookie,
          origin: SPOTIFY_ORIGIN,
          referer: SPOTIFY_HOME,
        },
      });

      return typeof response.serverTime === "number" && Number.isFinite(response.serverTime) ? response.serverTime : undefined;
    } catch {
      return undefined;
    }
  }

  private async requestApi<T>(
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
    token: { accessToken: string },
    path: string,
    options: {
      method?: string;
      expectedStatus?: number | number[];
      responseType?: "json" | "text" | "arrayBuffer";
      body?: BodyInit | null;
    } = {},
  ): Promise<T> {
    try {
      return await client.request<T>(`${SPOTIFY_API_BASE}${path}`, {
        method: options.method,
        expectedStatus: options.expectedStatus ?? 200,
        responseType: options.responseType,
        body: options.body,
        headers: {
          authorization: `Bearer ${token.accessToken}`,
          accept: "application/json",
          "content-type": "application/json",
        },
      });
    } catch (error) {
      const upstreamDetails = isAutoCliError(error) && error.details ? error.details : undefined;
      const upstreamStatus = this.extractHttpStatus(error);

      if (upstreamStatus === 429) {
        throw new AutoCliError("SPOTIFY_API_RATE_LIMITED", "Spotify API rate limit exceeded. Try again later.", {
          cause: error,
          details: {
            platform: this.platform,
            path,
            ...(upstreamDetails ?? {}),
          },
        });
      }

      throw new AutoCliError("PLATFORM_REQUEST_FAILED", "Spotify API request failed.", {
        cause: error,
        details: {
          platform: this.platform,
          path,
          ...(upstreamDetails ?? {}),
        },
      });
    }
  }

  private extractHttpStatus(error: unknown): number | undefined {
    if (!isAutoCliError(error)) {
      return undefined;
    }

    const status = error.details?.status;
    return typeof status === "number" && Number.isFinite(status) ? status : undefined;
  }

  private async loadPublicEntity<T>(type: SpotifyEntityType, id: string): Promise<T> {
    const url = buildSpotifyEntityUrl(type, id);
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new AutoCliError("SPOTIFY_ENTITY_NOT_FOUND", `Spotify could not load the requested ${type}.`, {
        details: {
          platform: this.platform,
          type,
          id,
          url,
          status: response.status,
        },
      });
    }

    const html = await response.text();
    const initialState = extractSpotifyScriptPayload<SpotifyInitialState>(html, "initialState");
    const entityKey = `spotify:${type}:${id}`;
    const entity = initialState.entities?.items?.[entityKey];

    if (!entity) {
      throw new AutoCliError("SPOTIFY_ENTITY_NOT_FOUND", `Spotify page data did not include the requested ${type}.`, {
        details: {
          platform: this.platform,
          type,
          id,
          entityKey,
          url,
        },
      });
    }

    return entity as T;
  }

  private toSessionUser(profile: SpotifyMeResponse): SessionUser {
    return {
      id: profile.id,
      username: profile.id,
      displayName: profile.display_name,
      profileUrl: profile.external_urls?.spotify,
    };
  }

  private async createAuthorizedContext(account?: string): Promise<{
    session: PlatformSession;
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>;
    accessToken: SpotifyTokenResponse & { accessToken: string };
  }> {
    const { session } = await this.ensureSavedSession(account);
    const client = await this.createSpotifyClient(session);
    const accessToken = await this.resolveAccessToken(client, session.account);
    return { session, client, accessToken };
  }

  private async createConnectContext(account?: string): Promise<{
    session: PlatformSession;
    connect: SpotifyConnectClient;
  }> {
    const { session, client, accessToken } = await this.createAuthorizedContext(account);
    const deviceId = await client.getCookieValue("sp_t", SPOTIFY_HOME);
    if (!deviceId) {
      throw new AutoCliError("SPOTIFY_CONNECT_DEVICE_COOKIE_MISSING", "Spotify Connect requires the sp_t cookie from the saved browser session.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    const clientVersion = await this.resolveSpotifyClientVersion(session, client);
    const clientId = typeof accessToken.clientId === "string" && accessToken.clientId.length > 0 ? accessToken.clientId : undefined;
    if (!clientId) {
      throw new AutoCliError("SPOTIFY_CONNECT_CLIENT_ID_MISSING", "Spotify access token bootstrap did not expose the Spotify web client id.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    return {
      session,
      connect: new SpotifyConnectClient(client, {
        accessToken: accessToken.accessToken,
        clientId,
        clientVersion,
        deviceId,
      }),
    };
  }

  private async resolveSpotifyClientVersion(
    session: PlatformSession,
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
  ): Promise<string> {
    const fromMetadata = session.metadata?.clientVersion;
    if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
      return fromMetadata.split(".g")[0] ?? fromMetadata;
    }

    const config = await this.resolveSpotifyAppServerConfig(client);
    if (typeof config.clientVersion === "string" && config.clientVersion.length > 0) {
      return config.clientVersion.split(".g")[0] ?? config.clientVersion;
    }

    throw new AutoCliError("SPOTIFY_CONNECT_CLIENT_VERSION_MISSING", "Spotify homepage config did not expose the current client version.");
  }

  private async resolveSpotifyAppServerConfig(
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
  ): Promise<SpotifyAppServerConfig> {
    const html = await client.request<string>(SPOTIFY_HOME, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    return extractSpotifyScriptPayload<SpotifyAppServerConfig>(html, "appServerConfig");
  }

  private async runSpotifyPlaybackEngine<T>(
    requestedEngine: SpotifyEngine | undefined,
    handlers: {
      connect: () => Promise<T>;
      web: () => Promise<T>;
    },
  ): Promise<{ engine: "connect" | "web"; result: T }> {
    const engine = requestedEngine ?? "auto";
    if (engine === "web") {
      return {
        engine: "web",
        result: await handlers.web(),
      };
    }

    if (engine === "connect") {
      return {
        engine: "connect",
        result: await handlers.connect(),
      };
    }

    try {
      return {
        engine: "connect",
        result: await handlers.connect(),
      };
    } catch (error) {
      if (!this.shouldFallbackFromConnect(error)) {
        throw error;
      }

      return {
        engine: "web",
        result: await handlers.web(),
      };
    }
  }

  private shouldFallbackFromConnect(error: unknown): boolean {
    if (!isAutoCliError(error)) {
      return false;
    }

    return error.code.startsWith("SPOTIFY_CONNECT_") || error.code === "SPOTIFY_DEVICE_NOT_FOUND";
  }

  private shouldFallbackSpotifySearch(error: unknown): boolean {
    if (!isAutoCliError(error)) {
      return false;
    }

    return (
      this.shouldFallbackFromConnect(error) ||
      error.code.startsWith("SPOTIFY_PATHFINDER_") ||
      error.code === "SPOTIFY_CONNECT_REQUEST_FAILED" ||
      error.code === "HTTP_REQUEST_FAILED"
    );
  }

  private withEngine(result: AdapterActionResult, engine: "connect" | "web"): AdapterActionResult {
    const data = result.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        ...result,
        data: {
          engine,
        },
      };
    }

    return {
      ...result,
      data: {
        ...data,
        engine,
      },
    };
  }

  private async listDevices(
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
    token: SpotifyTokenResponse & { accessToken: string },
  ): Promise<SpotifyPlaybackDevice[]> {
    const response = await this.requestApi<SpotifyDevicesResponse>(client, token, "/me/player/devices");
    return response.devices ?? [];
  }

  private async resolveOptionalDeviceId(
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
    token: SpotifyTokenResponse & { accessToken: string },
    target?: string,
  ): Promise<string | undefined> {
    if (!target || target.trim().length === 0) {
      return undefined;
    }

    const device = await this.resolveDevice(client, token, target);
    return device.id;
  }

  private async resolveDevice(
    client: Awaited<ReturnType<SpotifyAdapter["createSpotifyClient"]>>,
    token: SpotifyTokenResponse & { accessToken: string },
    target: string,
  ): Promise<SpotifyPlaybackDevice & { id: string }> {
    const devices = await this.listDevices(client, token);
    const trimmed = target.trim();
    const normalized = trimmed.toLowerCase();

    const exactId = devices.find((device): device is SpotifyPlaybackDevice & { id: string } => device.id === trimmed);
    if (exactId) {
      return exactId;
    }

    if (normalized === "active") {
      const active = devices.find((device): device is SpotifyPlaybackDevice & { id: string } => Boolean(device.is_active && device.id));
      if (active) {
        return active;
      }
    }

    const exactName = devices.find(
      (device): device is SpotifyPlaybackDevice & { id: string } =>
        Boolean(device.id) && typeof device.name === "string" && device.name.toLowerCase() === normalized,
    );
    if (exactName) {
      return exactName;
    }

    const partialName = devices.find(
      (device): device is SpotifyPlaybackDevice & { id: string } =>
        Boolean(device.id) && typeof device.name === "string" && device.name.toLowerCase().includes(normalized),
    );
    if (partialName) {
      return partialName;
    }

    throw new AutoCliError("SPOTIFY_DEVICE_NOT_FOUND", `Spotify device "${target}" was not found.`, {
      details: {
        platform: this.platform,
        target,
        availableDevices: devices.map((device) => ({
          id: device.id,
          name: device.name,
          type: device.type,
          isActive: device.is_active,
        })),
      },
    });
  }

  private normalizeDevice(device: SpotifyPlaybackDevice): SpotifyConnectDeviceSummary {
    return {
      id: device.id ?? "",
      name: device.name,
      type: device.type,
      isActive: Boolean(device.is_active),
      isPrivateSession: Boolean(device.is_private_session),
      isRestricted: Boolean(device.is_restricted),
      volumePercent: typeof device.volume_percent === "number" ? device.volume_percent : undefined,
      supportsVolume: typeof device.supports_volume === "boolean" ? device.supports_volume : undefined,
    };
  }

  private normalizePlaylistSummary(playlist: SpotifyPlaylistSummary): Record<string, unknown> {
    return {
      id: playlist.id,
      title: playlist.name,
      description: cleanSpotifyText(playlist.description),
      owner: playlist.owner?.display_name,
      totalTracks: typeof playlist.tracks?.total === "number" ? `${playlist.tracks.total} tracks` : undefined,
      public: typeof playlist.public === "boolean" ? playlist.public : undefined,
      collaborative: Boolean(playlist.collaborative),
      url: playlist.external_urls?.spotify,
    };
  }

  private normalizeTrack(track?: SpotifyApiTrack): SpotifyConnectTrackSummary | undefined {
    if (!track) {
      return undefined;
    }

    return {
      id: track.id,
      title: track.name,
      artists: track.artists?.map((artist) => artist.name).filter(Boolean).join(", "),
      album: track.album?.name,
      duration: formatSpotifyDuration(track.duration_ms),
      uri: track.uri,
      url:
        track.external_urls?.spotify ??
        spotifyUriToUrl(track.uri) ??
        (track.id ? buildSpotifyEntityUrl("track", track.id) : undefined),
    };
  }

  private normalizePlaybackState(state: SpotifyPlaybackStateResponse): SpotifyConnectPlaybackSummary {
    const track = this.normalizeTrack(state.item);
    return {
      isPlaying: Boolean(state.is_playing),
      repeatState: typeof state.repeat_state === "string" ? state.repeat_state : undefined,
      shuffleState:
        typeof state.shuffle_state === "boolean" ? (state.shuffle_state ? "on" : "off") : undefined,
      progress: formatSpotifyDuration(state.progress_ms),
      progressMs: typeof state.progress_ms === "number" ? state.progress_ms : undefined,
      currentlyPlayingType: state.currently_playing_type,
      deviceId: state.device?.id,
      deviceName: state.device?.name,
      deviceType: state.device?.type,
      contextUri: state.context?.uri,
      contextUrl: state.context?.external_urls?.spotify ?? spotifyUriToUrl(state.context?.uri),
      title: track?.title,
      artists: track?.artists,
      album: track?.album,
      duration: track?.duration,
      trackId: track?.id,
      trackUrl: track?.url,
    };
  }

  private toQuerySuffix(params: URLSearchParams): string {
    const serialized = params.toString();
    return serialized.length > 0 ? `?${serialized}` : "";
  }

  private countSearchResults(response: SpotifySearchResponse, type: SpotifySearchInput["type"]): number {
    switch (type) {
      case "album":
        return response.albums?.items?.length ?? 0;
      case "artist":
        return response.artists?.items?.length ?? 0;
      case "playlist":
        return response.playlists?.items?.length ?? 0;
      case "track":
      default:
        return response.tracks?.items?.length ?? 0;
    }
  }

  private normalizeSearchResults(response: SpotifySearchResponse, type: NonNullable<SpotifySearchInput["type"]>): Array<Record<string, unknown>> {
    switch (type) {
      case "album":
        return (response.albums?.items ?? []).map((item) => ({
          type,
          id: item.id,
          title: item.name,
          subtitle: item.artists?.map((artist) => artist.name).filter(Boolean).join(", "),
          detail: [item.release_date, typeof item.total_tracks === "number" ? `${item.total_tracks} tracks` : undefined]
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .join(" • "),
          url: item.external_urls?.spotify,
          imageUrl: item.images?.[0]?.url,
        }));
      case "artist":
        return (response.artists?.items ?? []).map((item) => ({
          type,
          id: item.id,
          title: item.name,
          subtitle:
            typeof item.followers?.total === "number" ? `${item.followers.total.toLocaleString("en-US")} followers` : undefined,
          url: item.external_urls?.spotify,
          imageUrl: item.images?.[0]?.url,
        }));
      case "playlist":
        return (response.playlists?.items ?? []).map((item) => ({
          type,
          id: item.id,
          title: item.name,
          subtitle: item.owner?.display_name,
          detail: typeof item.tracks?.total === "number" ? `${item.tracks.total} tracks` : undefined,
          url: item.external_urls?.spotify,
          imageUrl: item.images?.[0]?.url,
        }));
      case "track":
      default:
        return (response.tracks?.items ?? []).map((item) => ({
          type: "track",
          id: item.id,
          title: item.name,
          subtitle: item.artists?.map((artist) => artist.name).filter(Boolean).join(", "),
          detail: [item.album?.name, formatSpotifyDuration(item.duration_ms)].filter(
            (value): value is string => typeof value === "string" && value.length > 0,
          ).join(" • "),
          url: item.external_urls?.spotify,
          imageUrl: item.album?.images?.[0]?.url,
        }));
    }
  }

  private joinArtistNames(items?: SpotifyArtistRef[]): string | undefined {
    const names = (items ?? [])
      .map((item) => item.profile?.name)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    return names.length > 0 ? names.join(", ") : undefined;
  }
}
