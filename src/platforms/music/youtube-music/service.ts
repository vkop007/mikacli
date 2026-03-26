import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

import { Cookie, CookieJar } from "tough-cookie";

import { AutoCliError, isAutoCliError } from "../../../errors.js";
import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  TextPostInput,
} from "../../../types.js";
import { maybeAutoRefreshSession } from "../../../utils/autorefresh.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { parseYouTubeMusicBrowseTarget, parseYouTubeTarget } from "../../../utils/targets.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";
import {
  clearYouTubeMusicControllerState,
  createEmptyYouTubeMusicControllerState,
  estimateYouTubeMusicPlaybackPositionMs,
  getYouTubeMusicControllerCurrentItem,
  isYouTubeMusicControllerProcessAlive,
  loadYouTubeMusicControllerState,
  pauseYouTubeMusicPlayback,
  reconcileYouTubeMusicControllerState,
  resumeYouTubeMusicPlayback,
  saveYouTubeMusicControllerState,
  spawnYouTubeMusicPlayback,
  stopYouTubeMusicPlayback,
  type YouTubeMusicControllerQueueItem,
  type YouTubeMusicControllerState,
} from "./controller.js";
import type { YouTubeMusicSearchType } from "./options.js";

const YTM_ORIGIN = getPlatformOrigin("youtube-music");
const YTM_HOME = getPlatformHomeUrl("youtube-music");
const YTM_WATCH = `${YTM_ORIGIN}/watch?v=`;
const YTM_CLIENT_NAME = "WEB_REMIX";
const YTM_CLIENT_NAME_ID = "67";
const YTM_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const YTM_COOKIE_ALLOWLIST = new Set([
  "APISID",
  "CONSENT",
  "GPS",
  "HSID",
  "LOGIN_INFO",
  "PREF",
  "SAPISID",
  "SID",
  "SIDCC",
  "SSID",
  "VISITOR_INFO1_LIVE",
  "YSC",
  "__Secure-1PAPISID",
  "__Secure-1PSID",
  "__Secure-1PSIDCC",
  "__Secure-1PSIDTS",
  "__Secure-3PAPISID",
  "__Secure-3PSID",
  "__Secure-3PSIDCC",
  "__Secure-3PSIDTS",
]);

type YouTubeMusicItemType = YouTubeMusicSearchType;

interface YouTubeMusicProbe {
  status: SessionStatus;
  metadata?: Record<string, unknown>;
}

interface YouTubeMusicPageConfig {
  apiKey?: string;
  clientVersion?: string;
  visitorData?: string;
  delegatedSessionId?: string;
  sessionIndex?: string;
  hl?: string;
  gl?: string;
  loggedIn?: boolean;
}

interface YouTubeMusicActionContext {
  client: SessionHttpClient;
  page: YouTubeMusicPageConfig;
  apiKey: string;
  clientVersion: string;
  url: string;
}

interface YouTubeMusicSearchItem {
  type: YouTubeMusicItemType;
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  url: string;
  thumbnailUrl?: string;
}

interface YouTubeMusicInfo {
  id: string;
  title: string;
  url: string;
  artists?: string;
  album?: string;
  duration?: string;
  description?: string;
  thumbnailUrl?: string;
}

interface YouTubeMusicBrowseInfo {
  id: string;
  type: "album" | "artist" | "playlist";
  title: string;
  url: string;
  subtitle?: string;
  description?: string;
  thumbnailUrl?: string;
  itemCount?: number;
  results?: YouTubeMusicSearchItem[];
  sections?: Array<{
    title?: string;
    results: YouTubeMusicSearchItem[];
  }>;
}

interface YouTubeMusicPlaybackStatusData {
  mode: "stopped" | "playing" | "paused";
  currentIndex?: number;
  queueLength: number;
  positionMs?: number;
  position?: string;
  item?: YouTubeMusicControllerQueueItem;
}

interface YouTubeMusicPlaybackResolveInput {
  account?: string;
  target: string;
  type?: YouTubeMusicSearchType;
  limit?: number;
}

export class YouTubeMusicAdapter extends BasePlatformAdapter {
  readonly platform = "youtube-music" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const probe = await this.inspectCookieJar(imported.jar);
    const account = input.account ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "YouTube Music session has expired.", {
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
          ? `Saved YouTube Music session for ${account}.`
          : `Saved YouTube Music session for ${account}, but it should be revalidated before heavy use.`,
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
      user: session.user,
    });
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "YouTube Music uploads are not implemented in this CLI.");
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "YouTube Music text posting is not implemented in this CLI.");
  }

  async comment(_input: CommentInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "YouTube Music comments are not implemented in this CLI.");
  }

  async search(input: {
    account?: string;
    query: string;
    type?: YouTubeMusicSearchType;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("INVALID_SEARCH_QUERY", "Expected a non-empty YouTube Music search query.");
    }

    const limit = this.normalizeLimit(input.limit);
    const searchUrl = `${YTM_ORIGIN}/search?q=${encodeURIComponent(query)}`;
    const context = await this.prepareReadActionContext(input.account, YTM_HOME);

    let items: YouTubeMusicSearchItem[];
    try {
      const response = await context.client.request<Record<string, unknown>>(this.buildYoutubeiUrl("search", context.apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildApiHeaders(context.client, {
          allowAnonymous: !context.authenticated,
          clientVersion: context.clientVersion,
          visitorData: context.page.visitorData,
          delegatedSessionId: context.page.delegatedSessionId,
          sessionIndex: context.page.sessionIndex,
          referer: searchUrl,
        }),
        body: JSON.stringify({
          context: this.buildMusicContext({
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            hl: context.page.hl,
            gl: context.page.gl,
            originalUrl: searchUrl,
          }),
          query,
        }),
      });

      items = this.extractSearchResults(response, input.type).slice(0, limit);
    } catch (error) {
      throw this.mapWriteError(error, "Failed to search YouTube Music.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: context.account,
      action: "search",
      message:
        items.length > 0
          ? `Found ${items.length} YouTube Music result${items.length === 1 ? "" : "s"} for "${query}".`
          : `No YouTube Music results found for "${query}".`,
      url: searchUrl,
      data: {
        query,
        type: input.type,
        limit,
        results: items.map((item) => ({ ...item })),
      },
    };
  }

  async info(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareReadActionContext(input.account, this.buildWatchUrl(target.videoId));

    let info: YouTubeMusicInfo;
    try {
      const response = await context.client.request<Record<string, unknown>>(this.buildYoutubeiUrl("player", context.apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildApiHeaders(context.client, {
          allowAnonymous: !context.authenticated,
          clientVersion: context.clientVersion,
          visitorData: context.page.visitorData,
          delegatedSessionId: context.page.delegatedSessionId,
          sessionIndex: context.page.sessionIndex,
          referer: context.url,
        }),
        body: JSON.stringify({
          context: this.buildMusicContext({
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            hl: context.page.hl,
            gl: context.page.gl,
            originalUrl: context.url,
          }),
          videoId: target.videoId,
        }),
      });

      info = this.parseInfoResponse(response, target.videoId, context.url);
    } catch (error) {
      if (isAutoCliError(error) && (error.code === "YTMUSIC_ITEM_UNAVAILABLE" || error.code === "YTMUSIC_INFO_MISSING")) {
        info = await this.loadPublicYouTubeInfo(target.videoId, context.url);
      } else {
        throw this.mapWriteError(error, "Failed to fetch YouTube Music item details.");
      }
    }

    return {
      ok: true,
      platform: this.platform,
      account: context.account,
      action: "songid",
      message: `Loaded YouTube Music item details for ${info.id}.`,
      id: info.id,
      url: info.url,
      data: { ...info },
    };
  }

  async related(input: {
    account?: string;
    target: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareReadActionContext(input.account, this.buildWatchUrl(target.videoId));
    const limit = this.normalizeLimit(input.limit);

    let items: YouTubeMusicSearchItem[];
    try {
      const response = await context.client.request<Record<string, unknown>>(this.buildYoutubeiUrl("next", context.apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildApiHeaders(context.client, {
          allowAnonymous: !context.authenticated,
          clientVersion: context.clientVersion,
          visitorData: context.page.visitorData,
          delegatedSessionId: context.page.delegatedSessionId,
          sessionIndex: context.page.sessionIndex,
          referer: context.url,
        }),
        body: JSON.stringify({
          context: this.buildMusicContext({
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            hl: context.page.hl,
            gl: context.page.gl,
            originalUrl: context.url,
          }),
          videoId: target.videoId,
        }),
      });

      items = this.extractRelatedResults(response, target.videoId).slice(0, limit);
    } catch (error) {
      throw this.mapWriteError(error, "Failed to load related YouTube Music items.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: context.account,
      action: "related",
      message:
        items.length > 0
          ? `Found ${items.length} related YouTube Music item${items.length === 1 ? "" : "s"}.`
          : "No related YouTube Music items found.",
      id: target.videoId,
      url: context.url,
      data: {
        targetVideoId: target.videoId,
        limit,
        results: items.map((item) => ({ ...item })),
      },
    };
  }

  async album(input: {
    account?: string;
    target: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const info = await this.loadBrowseInfo({
      account: input.account,
      target: input.target,
      type: "album",
      limit: input.limit,
    });

    return {
      ok: true,
      platform: this.platform,
      account: info.account,
      action: "albumid",
      message: `Loaded YouTube Music album details for ${info.data.title}.`,
      id: info.data.id,
      url: info.data.url,
      data: { ...info.data },
    };
  }

  async artist(input: {
    account?: string;
    target: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const info = await this.loadBrowseInfo({
      account: input.account,
      target: input.target,
      type: "artist",
      limit: input.limit,
    });

    return {
      ok: true,
      platform: this.platform,
      account: info.account,
      action: "artistid",
      message: `Loaded YouTube Music artist details for ${info.data.title}.`,
      id: info.data.id,
      url: info.data.url,
      data: { ...info.data },
    };
  }

  async playlist(input: {
    account?: string;
    target: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const info = await this.loadBrowseInfo({
      account: input.account,
      target: input.target,
      type: "playlist",
      limit: input.limit,
    });

    return {
      ok: true,
      platform: this.platform,
      account: info.account,
      action: "playlistid",
      message: `Loaded YouTube Music playlist details for ${info.data.title}.`,
      id: info.data.id,
      url: info.data.url,
      data: { ...info.data },
    };
  }

  async playbackStatus(): Promise<AdapterActionResult> {
    const state = await this.loadControllerState();
    const current = getYouTubeMusicControllerCurrentItem(state);
    const positionMs =
      current && (state.mode === "playing" || state.mode === "paused")
        ? estimateYouTubeMusicPlaybackPositionMs(state)
        : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "status",
      message: current
        ? `YouTube Music is ${state.mode} on queue item ${state.currentIndex + 1}/${state.queue.length}.`
        : "No local YouTube Music playback is active.",
      id: current?.id,
      url: current?.url,
      data: {
        mode: state.mode,
        queueLength: state.queue.length,
        ...(typeof state.currentIndex === "number" && state.queue.length > 0 ? { currentIndex: state.currentIndex + 1 } : {}),
        ...(typeof positionMs === "number" ? { positionMs, position: formatDuration(Math.floor(positionMs / 1_000)) } : {}),
        ...(current ? { item: { ...current } } : {}),
      } satisfies YouTubeMusicPlaybackStatusData,
    };
  }

  async play(input: {
    account?: string;
    target?: string;
    type?: YouTubeMusicSearchType;
    limit?: number;
  }): Promise<AdapterActionResult> {
    await this.requireCommand("yt-dlp", ["--version"], "YTDLP_NOT_FOUND", "yt-dlp is required for youtube-music playback.");
    await this.requireCommand("ffplay", ["-version"], "FFPLAY_NOT_FOUND", "ffplay is required for youtube-music playback.");

    let state = await this.loadControllerState();

    if (!input.target || input.target.trim().length === 0) {
      const current = getYouTubeMusicControllerCurrentItem(state);
      if (!current) {
        throw new AutoCliError("YTMUSIC_QUEUE_EMPTY", "No queued YouTube Music item is available. Use `play <target>` first.");
      }

      if (state.mode === "paused" && state.currentPid && isYouTubeMusicControllerProcessAlive(state.currentPid)) {
        await resumeYouTubeMusicPlayback(state.currentPid);
        state = {
          ...state,
          mode: "playing",
          startedAt: new Date().toISOString(),
          pausedAt: undefined,
        };
        await saveYouTubeMusicControllerState(state);

        return {
          ok: true,
          platform: this.platform,
          account: "local",
          action: "play",
          message: `Resumed YouTube Music playback: ${current.title}.`,
          id: current.id,
          url: current.url,
          data: {
            mode: state.mode,
            queueLength: state.queue.length,
            currentIndex: state.currentIndex + 1,
            item: { ...current },
          },
        };
      }

      state = await this.startControllerPlayback(state, state.currentIndex);
      const restarted = getYouTubeMusicControllerCurrentItem(state);
      return {
        ok: true,
        platform: this.platform,
        account: "local",
        action: "play",
        message: `Started YouTube Music playback: ${restarted?.title ?? "current item"}.`,
        id: restarted?.id,
        url: restarted?.url,
        data: {
          mode: state.mode,
          queueLength: state.queue.length,
          currentIndex: state.currentIndex + 1,
          item: restarted ? { ...restarted } : undefined,
        },
      };
    }

    const items = await this.resolvePlaybackItems({
      account: input.account,
      target: input.target,
      type: input.type,
      limit: input.limit,
    });
    if (items.length === 0) {
      throw new AutoCliError("YTMUSIC_QUEUE_EMPTY", "No playable YouTube Music items were resolved for this target.");
    }

    state = createEmptyYouTubeMusicControllerState();
    state.queue = items;
    state.currentIndex = 0;
    state = await this.startControllerPlayback(state, 0);
    const current = getYouTubeMusicControllerCurrentItem(state);

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "play",
      message: `Started YouTube Music playback: ${current?.title ?? "selected item"}.`,
      id: current?.id,
      url: current?.url,
      data: {
        mode: state.mode,
        queueLength: state.queue.length,
        currentIndex: state.currentIndex + 1,
        item: current ? { ...current } : undefined,
      },
    };
  }

  async pause(): Promise<AdapterActionResult> {
    const state = await this.loadControllerState();
    const current = getYouTubeMusicControllerCurrentItem(state);

    if (!current) {
      throw new AutoCliError("YTMUSIC_CONTROLLER_NOT_RUNNING", "No local YouTube Music playback is active.");
    }

    if (state.mode === "paused") {
      return {
        ok: true,
        platform: this.platform,
        account: "local",
        action: "pause",
        message: `YouTube Music is already paused: ${current.title}.`,
        id: current.id,
        url: current.url,
      };
    }

    await pauseYouTubeMusicPlayback(state.currentPid);
    const now = Date.now();
    const nextState: YouTubeMusicControllerState = {
      ...state,
      mode: "paused",
      basePositionMs: estimateYouTubeMusicPlaybackPositionMs(state, now),
      startedAt: undefined,
      pausedAt: new Date(now).toISOString(),
    };
    await saveYouTubeMusicControllerState(nextState);

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "pause",
      message: `Paused YouTube Music playback: ${current.title}.`,
      id: current.id,
      url: current.url,
    };
  }

  async stop(): Promise<AdapterActionResult> {
    const state = await this.loadControllerState();
    const current = getYouTubeMusicControllerCurrentItem(state);

    if (!current) {
      await clearYouTubeMusicControllerState();
      return {
        ok: true,
        platform: this.platform,
        account: "local",
        action: "stop",
        message: "No local YouTube Music playback was running.",
      };
    }

    await stopYouTubeMusicPlayback(state.currentPid);
    const nextState: YouTubeMusicControllerState = {
      ...state,
      mode: "stopped",
      currentPid: undefined,
      startedAt: undefined,
      pausedAt: undefined,
      basePositionMs: 0,
    };
    await saveYouTubeMusicControllerState(nextState);

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "stop",
      message: `Stopped YouTube Music playback: ${current.title}.`,
      id: current.id,
      url: current.url,
    };
  }

  async next(): Promise<AdapterActionResult> {
    const state = await this.loadControllerState();
    if (state.queue.length === 0) {
      throw new AutoCliError("YTMUSIC_QUEUE_EMPTY", "The local YouTube Music queue is empty.");
    }

    if (state.currentIndex >= state.queue.length - 1) {
      throw new AutoCliError("YTMUSIC_QUEUE_ENDED", "There is no next YouTube Music item in the local queue.");
    }

    const nextState = await this.startControllerPlayback(state, state.currentIndex + 1);
    const current = getYouTubeMusicControllerCurrentItem(nextState);

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "next",
      message: `Skipped to the next YouTube Music item: ${current?.title ?? "unknown"}.`,
      id: current?.id,
      url: current?.url,
      data: {
        queueLength: nextState.queue.length,
        currentIndex: nextState.currentIndex + 1,
        item: current ? { ...current } : undefined,
      },
    };
  }

  async previous(): Promise<AdapterActionResult> {
    const state = await this.loadControllerState();
    if (state.queue.length === 0) {
      throw new AutoCliError("YTMUSIC_QUEUE_EMPTY", "The local YouTube Music queue is empty.");
    }

    const positionMs = estimateYouTubeMusicPlaybackPositionMs(state);
    const previousIndex = positionMs > 5_000 ? state.currentIndex : Math.max(0, state.currentIndex - 1);
    const nextState = await this.startControllerPlayback(state, previousIndex);
    const current = getYouTubeMusicControllerCurrentItem(nextState);

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "previous",
      message: `Moved to the previous YouTube Music item: ${current?.title ?? "unknown"}.`,
      id: current?.id,
      url: current?.url,
      data: {
        queueLength: nextState.queue.length,
        currentIndex: nextState.currentIndex + 1,
        item: current ? { ...current } : undefined,
      },
    };
  }

  async queue(): Promise<AdapterActionResult> {
    const state = await this.loadControllerState();
    const current = getYouTubeMusicControllerCurrentItem(state);

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "queue",
      message:
        state.queue.length > 0
          ? `Loaded the local YouTube Music queue with ${state.queue.length} item${state.queue.length === 1 ? "" : "s"}.`
          : "The local YouTube Music queue is empty.",
      id: current?.id,
      url: current?.url,
      data: {
        mode: state.mode,
        queueLength: state.queue.length,
        currentIndex: state.queue.length > 0 ? state.currentIndex + 1 : undefined,
        items: state.queue.map((item, index) => ({
          ...item,
          position: index + 1,
          current: index === state.currentIndex,
        })),
      },
    };
  }

  async queueAdd(input: YouTubeMusicPlaybackResolveInput): Promise<AdapterActionResult> {
    const items = await this.resolvePlaybackItems(input);
    if (items.length === 0) {
      throw new AutoCliError("YTMUSIC_QUEUE_EMPTY", "No playable YouTube Music items were resolved for this target.");
    }

    const state = await this.loadControllerState();
    const nextState: YouTubeMusicControllerState = {
      ...state,
      queue: [...state.queue, ...items],
      currentIndex: state.queue.length === 0 ? 0 : state.currentIndex,
    };
    await saveYouTubeMusicControllerState(nextState);

    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: "queueadd",
      message: `Added ${items.length} item${items.length === 1 ? "" : "s"} to the local YouTube Music queue.`,
      data: {
        added: items.map((item) => ({ ...item })),
        queueLength: nextState.queue.length,
        currentIndex: nextState.queue.length > 0 ? nextState.currentIndex + 1 : undefined,
      },
    };
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    return this.executePreferenceAction(input, {
      action: "like",
      path: "like/like",
      expectedLikeStatus: "LIKE",
      fallbackMessage: "Failed to like the YouTube Music item.",
      message: (account) => `YouTube Music item liked for ${account}.`,
    });
  }

  async dislike(input: LikeInput): Promise<AdapterActionResult> {
    return this.executePreferenceAction(input, {
      action: "dislike",
      path: "like/dislike",
      expectedLikeStatus: "DISLIKE",
      fallbackMessage: "Failed to dislike the YouTube Music item.",
      message: (account) => `YouTube Music item disliked for ${account}.`,
    });
  }

  async unlike(input: LikeInput): Promise<AdapterActionResult> {
    return this.executePreferenceAction(input, {
      action: "unlike",
      path: "like/removelike",
      expectedLikeStatus: "INDIFFERENT",
      fallbackMessage: "Failed to remove the YouTube Music like/dislike state.",
      message: (account) => `YouTube Music preference cleared for ${account}.`,
    });
  }

  private async executePreferenceAction(
    input: LikeInput,
    options: {
      action: string;
      path: string;
      expectedLikeStatus: "LIKE" | "DISLIKE" | "INDIFFERENT";
      fallbackMessage: string;
      message: (account: string) => string;
    },
  ): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    await this.ensureUsableSession(session);

    const target = parseYouTubeTarget(input.target);
    const context = await this.prepareSongActionContext(session, target.videoId);

    try {
      const response = await context.client.request<Record<string, unknown>>(this.buildYoutubeiUrl(options.path, context.apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildApiHeaders(context.client, {
          clientVersion: context.clientVersion,
          visitorData: context.page.visitorData,
          delegatedSessionId: context.page.delegatedSessionId,
          sessionIndex: context.page.sessionIndex,
          referer: context.url,
        }),
        body: JSON.stringify({
          context: this.buildMusicContext({
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            hl: context.page.hl,
            gl: context.page.gl,
            originalUrl: context.url,
          }),
          target: {
            videoId: target.videoId,
          },
        }),
      });

      const likeStatus = this.extractLikeStatus(response);
      if (likeStatus && likeStatus !== options.expectedLikeStatus) {
        throw new AutoCliError("YTMUSIC_REQUEST_REJECTED", "YouTube Music did not apply the requested preference.", {
          details: {
            expectedLikeStatus: options.expectedLikeStatus,
            actualLikeStatus: likeStatus,
            path: options.path,
          },
        });
      }
    } catch (error) {
      throw this.mapWriteError(error, options.fallbackMessage);
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: options.action,
      message: options.message(session.account),
      id: target.videoId,
      url: context.url,
    };
  }

  private async ensureUsableSession(session: PlatformSession): Promise<void> {
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "YouTube Music session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }
  }

  private async prepareSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    return {
      path: loaded.path,
      session: await this.maybeAutoRefresh(loaded.session),
    };
  }

  private async maybeAutoRefresh(session: PlatformSession): Promise<PlatformSession> {
    const client = await this.createYouTubeMusicClient(session);
    const refresh = await maybeAutoRefreshSession({
      platform: this.platform,
      session,
      jar: client.jar,
      strategy: "homepage_keepalive",
      capability: "auto",
      refresh: async () => {
        await client.request<string>(YTM_HOME, {
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

  private async loadControllerState(): Promise<YouTubeMusicControllerState> {
    return reconcileYouTubeMusicControllerState(await loadYouTubeMusicControllerState());
  }

  private async startControllerPlayback(
    state: YouTubeMusicControllerState,
    index: number,
  ): Promise<YouTubeMusicControllerState> {
    const current = state.queue[index];
    if (!current) {
      throw new AutoCliError("YTMUSIC_QUEUE_EMPTY", "No YouTube Music item exists at that queue position.");
    }

    await stopYouTubeMusicPlayback(state.currentPid);
    const media = await this.resolvePlaybackMedia(current.url);
    const pid = await spawnYouTubeMusicPlayback(media.streamUrl);
    const nextState: YouTubeMusicControllerState = {
      ...state,
      queue: state.queue.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              title: media.title ?? item.title,
              durationMs: media.durationMs ?? item.durationMs,
              duration: media.duration ?? item.duration,
            }
          : item,
      ),
      currentIndex: index,
      currentPid: pid,
      mode: "playing",
      startedAt: new Date().toISOString(),
      pausedAt: undefined,
      basePositionMs: 0,
    };
    await saveYouTubeMusicControllerState(nextState);
    return nextState;
  }

  private async resolvePlaybackItems(input: YouTubeMusicPlaybackResolveInput): Promise<YouTubeMusicControllerQueueItem[]> {
    const target = input.target.trim();
    if (!target) {
      throw new AutoCliError("INVALID_TARGET", "Expected a YouTube Music target or search query.");
    }

    const limit = this.normalizeLimit(input.limit);
    const explicitType = input.type;
    const inferredType = explicitType ?? this.inferPlaybackTargetType(target);

    if (inferredType === "song" || inferredType === "video") {
      try {
        return [await this.resolveSinglePlaybackItem(input.account, target)];
      } catch (error) {
        if (!(isAutoCliError(error) && error.code === "INVALID_TARGET")) {
          throw error;
        }
      }
    }

    if (inferredType === "album" || inferredType === "artist" || inferredType === "playlist") {
      try {
        const items = await this.resolveCollectionPlaybackItems(input.account, target, inferredType, limit);
        if (items.length > 0) {
          return items;
        }
      } catch (error) {
        if (!(isAutoCliError(error) && error.code === "INVALID_TARGET")) {
          throw error;
        }
      }
    }

    return this.resolveSearchPlaybackItems(input.account, target, explicitType, limit);
  }

  private async resolveSinglePlaybackItem(
    account: string | undefined,
    target: string,
  ): Promise<YouTubeMusicControllerQueueItem> {
    const parsed = parseYouTubeTarget(target);
    const url = this.buildWatchUrl(parsed.videoId);
    const context = await this.prepareReadActionContext(account, url);

    let info: YouTubeMusicInfo;
    try {
      const response = await context.client.request<Record<string, unknown>>(this.buildYoutubeiUrl("player", context.apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildApiHeaders(context.client, {
          allowAnonymous: !context.authenticated,
          clientVersion: context.clientVersion,
          visitorData: context.page.visitorData,
          delegatedSessionId: context.page.delegatedSessionId,
          sessionIndex: context.page.sessionIndex,
          referer: url,
        }),
        body: JSON.stringify({
          context: this.buildMusicContext({
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            hl: context.page.hl,
            gl: context.page.gl,
            originalUrl: url,
          }),
          videoId: parsed.videoId,
        }),
      });
      info = this.parseInfoResponse(response, parsed.videoId, url);
    } catch (error) {
      if (isAutoCliError(error) && (error.code === "YTMUSIC_ITEM_UNAVAILABLE" || error.code === "YTMUSIC_INFO_MISSING")) {
        info = await this.loadPublicYouTubeInfo(parsed.videoId, url);
      } else {
        throw error;
      }
    }

    return {
      id: info.id,
      title: info.title,
      url: info.url,
      subtitle: info.artists,
      detail: info.duration,
      duration: info.duration,
      durationMs: parseDurationToMs(info.duration),
      thumbnailUrl: info.thumbnailUrl,
    };
  }

  private async resolveCollectionPlaybackItems(
    account: string | undefined,
    target: string,
    type: "album" | "artist" | "playlist",
    limit: number,
  ): Promise<YouTubeMusicControllerQueueItem[]> {
    const resolved = await this.loadBrowseInfo({
      account,
      target,
      type,
      limit,
    });
    const data = resolved.data;
    const candidates =
      type === "artist"
        ? (data.sections ?? []).flatMap((section) => section.results)
        : (data.results ?? []);

    const playable = candidates
      .filter((item) => item.type === "song" || item.type === "video")
      .slice(0, limit)
      .map((item) => this.toControllerQueueItem(item));

    if (playable.length === 0) {
      throw new AutoCliError(
        "YTMUSIC_PLAYBACK_UNSUPPORTED",
        `No directly playable ${type === "artist" ? "songs or videos" : "items"} were found for this YouTube Music target.`,
      );
    }

    return playable;
  }

  private async resolveSearchPlaybackItems(
    account: string | undefined,
    query: string,
    type: YouTubeMusicSearchType | undefined,
    limit: number,
  ): Promise<YouTubeMusicControllerQueueItem[]> {
    const searchResult = await this.search({
      account,
      query,
      type,
      limit: Math.max(limit, 5),
    });
    const results = Array.isArray(searchResult.data?.results) ? searchResult.data.results : [];

    const playable = results
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && typeof item.type === "string" && typeof item.url === "string"),
      )
      .filter((item) => item.type === "song" || item.type === "video")
      .slice(0, limit)
      .map((item) =>
        this.toControllerQueueItem({
          id: String(item.id ?? ""),
          type: item.type as YouTubeMusicItemType,
          title: String(item.title ?? "Untitled item"),
          subtitle: typeof item.subtitle === "string" ? item.subtitle : undefined,
          detail: typeof item.detail === "string" ? item.detail : undefined,
          url: String(item.url),
          thumbnailUrl: typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : undefined,
        }),
      );

    if (playable.length > 0) {
      return playable;
    }

    const collection = results.find(
      (item): item is Record<string, unknown> =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof item.type === "string" &&
            typeof item.id === "string" &&
            typeof item.url === "string" &&
            (item.type === "album" || item.type === "artist" || item.type === "playlist"),
        ),
    );

    if (collection && (collection.type === "album" || collection.type === "artist" || collection.type === "playlist")) {
      return this.resolveCollectionPlaybackItems(account, String(collection.url), collection.type, limit);
    }

    throw new AutoCliError("YTMUSIC_PLAYBACK_UNSUPPORTED", `No playable YouTube Music results were found for "${query}".`);
  }

  private toControllerQueueItem(item: YouTubeMusicSearchItem): YouTubeMusicControllerQueueItem {
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      subtitle: item.subtitle,
      detail: item.detail,
      duration: item.detail,
      durationMs: parseDurationToMs(item.detail),
      thumbnailUrl: item.thumbnailUrl,
    };
  }

  private inferPlaybackTargetType(target: string): YouTubeMusicSearchType | undefined {
    const trimmed = target.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed) || /(?:music\.)?youtube\.com\/watch\?/.test(trimmed) || /youtu\.be\//i.test(trimmed)) {
      return "song";
    }

    if (/^MPREb[_A-Za-z0-9-]+$/.test(trimmed) || /music\.youtube\.com\/browse\/MPREb/i.test(trimmed)) {
      return "album";
    }

    if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed) || /music\.youtube\.com\/browse\/UC/i.test(trimmed)) {
      return "artist";
    }

    if (
      /(?:music\.)?youtube\.com\/playlist\?/i.test(trimmed) ||
      /^(?:VL)?(?:PL|UU|LL|FL|RD|OLAK5uy_)[A-Za-z0-9_-]+$/.test(trimmed)
    ) {
      return "playlist";
    }

    return undefined;
  }

  private async resolvePlaybackMedia(url: string): Promise<{
    streamUrl: string;
    title?: string;
    duration?: string;
    durationMs?: number;
  }> {
    const { stdout } = await this.runProcess("yt-dlp", [
      "--no-playlist",
      "--no-warnings",
      "--quiet",
      "--format",
      "bestaudio/best",
      "--dump-single-json",
      "--extractor-args",
      "youtube:player_client=web_music,web",
      url,
    ]);

    const parsed = JSON.parse(stdout) as {
      url?: string;
      title?: string;
      duration?: number;
      duration_string?: string;
      requested_downloads?: Array<{
        url?: string;
      }>;
    };
    const streamUrl = parsed.requested_downloads?.[0]?.url ?? parsed.url;
    if (!streamUrl) {
      throw new AutoCliError("YTMUSIC_STREAM_RESOLVE_FAILED", "yt-dlp did not return a playable audio stream URL.");
    }

    return {
      streamUrl,
      title: parsed.title,
      duration:
        typeof parsed.duration_string === "string"
          ? parsed.duration_string
          : typeof parsed.duration === "number"
            ? formatDuration(parsed.duration)
            : undefined,
      durationMs: typeof parsed.duration === "number" ? parsed.duration * 1_000 : undefined,
    };
  }

  private async probeSession(session: PlatformSession): Promise<YouTubeMusicProbe> {
    const jar = await this.cookieManager.createJar(session);
    return this.inspectCookieJar(jar);
  }

  private async inspectCookieJar(jar: CookieJar): Promise<YouTubeMusicProbe> {
    const client = await this.createYouTubeMusicClientFromJar(jar);
    const authCookie = await this.getAuthCookieValue(client);
    const loginCookie =
      (await client.getCookieValue("LOGIN_INFO", YTM_HOME)) ??
      (await client.getCookieValue("SID", YTM_HOME)) ??
      (await client.getCookieValue("__Secure-3PSID", YTM_HOME));

    if (!authCookie || !loginCookie) {
      return {
        status: {
          state: "expired",
          message: "Missing required YouTube Music auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const html = await client.request<string>(YTM_HOME, {
        responseType: "text",
        expectedStatus: 200,
      });
      const page = this.parsePageConfig(html);

      if (page.loggedIn === true) {
        return {
          status: {
            state: "active",
            message: "Session validated via the YouTube Music homepage.",
            lastValidatedAt: new Date().toISOString(),
          },
          metadata: this.toMetadata(page),
        };
      }

      if (page.loggedIn === false) {
        return {
          status: {
            state: "expired",
            message: "YouTube Music returned a logged-out homepage. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "AUTH_FAILED",
          },
          metadata: this.toMetadata(page),
        };
      }

      return {
        status: {
          state: "unknown",
          message: "YouTube Music auth cookies are present, but homepage validation was inconclusive.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: this.toMetadata(page),
      };
    } catch (error) {
      return {
        status: {
          state: "unknown",
          message: "YouTube Music auth cookies are present, but homepage validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: isAutoCliError(error) ? error.details : undefined,
      };
    }
  }

  private async createYouTubeMusicClient(session: PlatformSession): Promise<SessionHttpClient> {
    const jar = await this.cookieManager.createJar(session);
    return this.createYouTubeMusicClientFromJar(jar);
  }

  private async createYouTubeMusicClientFromJar(jar: CookieJar): Promise<SessionHttpClient> {
    const filteredJar = await this.filterYouTubeMusicCookies(jar);
    return new SessionHttpClient(filteredJar, {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": YTM_USER_AGENT,
    });
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 5;
    }

    return Math.max(1, Math.min(25, Math.floor(limit)));
  }

  private async prepareSongActionContext(session: PlatformSession, videoId: string): Promise<YouTubeMusicActionContext> {
    const client = await this.createYouTubeMusicClient(session);
    const url = this.buildWatchUrl(videoId);
    return this.preparePageActionContext(client, url);
  }

  private async prepareReadActionContext(
    account: string | undefined,
    url: string,
  ): Promise<YouTubeMusicActionContext & { account: string; authenticated: boolean }> {
    try {
      const { session } = await this.prepareSession(account);
      await this.ensureUsableSession(session);
      const client = await this.createYouTubeMusicClient(session);
      const context = await this.preparePageActionContext(client, url);
      return {
        ...context,
        account: session.account,
        authenticated: true,
      };
    } catch (error) {
      if (
        !isAutoCliError(error) ||
        (error.code !== "SESSION_EXPIRED" && error.code !== "SESSION_NOT_FOUND" && error.code !== "SESSION_INVALID")
      ) {
        throw error;
      }

      const client = await this.createYouTubeMusicClientFromJar(new CookieJar());
      const page = await this.loadPageContext(client, url, false);
      return {
        account: account ?? "public",
        authenticated: false,
        client,
        page,
        apiKey: this.requirePageField(page.apiKey, "YouTube Music API key"),
        clientVersion: this.requirePageField(page.clientVersion, "YouTube Music client version"),
        url,
      };
    }
  }

  private async preparePageActionContext(client: SessionHttpClient, url: string): Promise<YouTubeMusicActionContext> {
    const page = await this.loadPageContext(client, url, true);
    return {
      client,
      page,
      apiKey: this.requirePageField(page.apiKey, "YouTube Music API key"),
      clientVersion: this.requirePageField(page.clientVersion, "YouTube Music client version"),
      url,
    };
  }

  private async loadPageContext(
    client: SessionHttpClient,
    url: string,
    requireLogin: boolean,
  ): Promise<YouTubeMusicPageConfig> {
    const html = await client.request<string>(url, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        referer: YTM_HOME,
      },
    });
    const page = this.parsePageConfig(html);
    if (requireLogin && page.loggedIn === false) {
      throw new AutoCliError("SESSION_EXPIRED", "YouTube Music returned a logged-out page. Re-import cookies.txt.");
    }

    return page;
  }

  private parsePageConfig(html: string): YouTubeMusicPageConfig {
    return {
      apiKey: this.matchQuotedValue(html, /"INNERTUBE_API_KEY":"([^"]+)"/),
      clientVersion: this.matchQuotedValue(html, /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/),
      visitorData: this.matchQuotedValue(html, /"VISITOR_DATA":"([^"]+)"/),
      delegatedSessionId: this.matchQuotedValue(html, /"DELEGATED_SESSION_ID":"([^"]+)"/),
      sessionIndex: this.matchQuotedValue(html, /"SESSION_INDEX":"?([^",}]+)"?/),
      hl: this.matchQuotedValue(html, /"INNERTUBE_CONTEXT":\{"client":\{"hl":"([^"]+)"/),
      gl: this.matchQuotedValue(html, /"INNERTUBE_CONTEXT":\{"client":\{[^}]*"gl":"([^"]+)"/),
      loggedIn: this.matchBoolean(html, /"LOGGED_IN":(true|false)/),
    };
  }

  private matchQuotedValue(html: string, pattern: RegExp): string | undefined {
    const match = html.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    try {
      return JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return match[1];
    }
  }

  private matchBoolean(html: string, pattern: RegExp): boolean | undefined {
    const match = html.match(pattern);
    if (!match?.[1]) {
      return undefined;
    }

    return match[1] === "true";
  }

  private toMetadata(page: YouTubeMusicPageConfig): Record<string, unknown> {
    return {
      ...(page.apiKey ? { apiKey: page.apiKey } : {}),
      ...(page.clientVersion ? { clientVersion: page.clientVersion } : {}),
      ...(page.visitorData ? { visitorData: page.visitorData } : {}),
      ...(page.delegatedSessionId ? { delegatedSessionId: page.delegatedSessionId } : {}),
      ...(page.sessionIndex ? { sessionIndex: page.sessionIndex } : {}),
      ...(page.hl ? { hl: page.hl } : {}),
      ...(page.gl ? { gl: page.gl } : {}),
    };
  }

  private requirePageField<T extends string>(value: T | undefined, label: string): T {
    if (!value) {
      throw new AutoCliError("YTMUSIC_PAGE_CONFIG_MISSING", `Missing ${label} from the YouTube Music page.`);
    }

    return value;
  }

  private buildYoutubeiUrl(path: string, apiKey: string): string {
    return `${YTM_ORIGIN}/youtubei/v1/${path}?prettyPrint=false&key=${encodeURIComponent(apiKey)}`;
  }

  private buildWatchUrl(videoId: string, playlistId?: string): string {
    const url = new URL(YTM_WATCH + encodeURIComponent(videoId));
    if (playlistId) {
      url.searchParams.set("list", playlistId);
    }
    return url.toString();
  }

  private buildBrowseUrl(browseId: string): string {
    return `${YTM_ORIGIN}/browse/${encodeURIComponent(browseId)}`;
  }

  private buildPlaylistUrl(playlistId: string): string {
    return `${YTM_ORIGIN}/playlist?list=${encodeURIComponent(playlistId)}`;
  }

  private async loadBrowseInfo(input: {
    account?: string;
    target: string;
    type: "album" | "artist" | "playlist";
    limit?: number;
  }): Promise<{
    account: string;
    data: YouTubeMusicBrowseInfo;
  }> {
    const target = parseYouTubeMusicBrowseTarget(input.target, input.type);
    const limit = this.normalizeLimit(input.limit);
    const url =
      input.type === "playlist" && target.canonicalTarget ? this.buildPlaylistUrl(target.canonicalTarget) : this.buildBrowseUrl(target.browseId);
    const context = await this.prepareReadActionContext(input.account, url);

    let data: YouTubeMusicBrowseInfo;
    try {
      const response = await context.client.request<Record<string, unknown>>(this.buildYoutubeiUrl("browse", context.apiKey), {
        method: "POST",
        expectedStatus: 200,
        headers: await this.buildApiHeaders(context.client, {
          allowAnonymous: !context.authenticated,
          clientVersion: context.clientVersion,
          visitorData: context.page.visitorData,
          delegatedSessionId: context.page.delegatedSessionId,
          sessionIndex: context.page.sessionIndex,
          referer: url,
        }),
        body: JSON.stringify({
          context: this.buildMusicContext({
            clientVersion: context.clientVersion,
            visitorData: context.page.visitorData,
            hl: context.page.hl,
            gl: context.page.gl,
            originalUrl: url,
          }),
          browseId: target.browseId,
        }),
      });

      data = this.parseBrowseResponse(response, {
        browseId: target.browseId,
        canonicalTarget: target.canonicalTarget,
        type: input.type,
        fallbackUrl: url,
        limit,
      });
    } catch (error) {
      throw this.mapWriteError(error, `Failed to load the YouTube Music ${input.type}.`);
    }

    return {
      account: context.account,
      data,
    };
  }

  private async buildApiHeaders(
    client: SessionHttpClient,
    input: {
      allowAnonymous?: boolean;
      clientVersion: string;
      visitorData?: string;
      delegatedSessionId?: string;
      sessionIndex?: string;
      referer: string;
    },
  ): Promise<Record<string, string>> {
    const sapisid = await this.getAuthCookieValue(client);
    if (!sapisid && !input.allowAnonymous) {
      throw new AutoCliError("SESSION_EXPIRED", "YouTube Music SAPISID cookie is missing. Re-import cookies.txt.");
    }

    return {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      ...(sapisid ? { authorization: buildSapisidHash(sapisid, YTM_ORIGIN) } : {}),
      "content-type": "application/json",
      origin: YTM_ORIGIN,
      referer: input.referer,
      "user-agent": YTM_USER_AGENT,
      "x-goog-authuser": input.sessionIndex ?? "0",
      ...(input.delegatedSessionId ? { "x-goog-pageid": input.delegatedSessionId } : {}),
      ...(input.visitorData ? { "x-goog-visitor-id": input.visitorData } : {}),
      "x-origin": YTM_ORIGIN,
      "x-youtube-bootstrap-logged-in": sapisid ? "true" : "false",
      "x-youtube-client-name": YTM_CLIENT_NAME_ID,
      "x-youtube-client-version": input.clientVersion,
    };
  }

  private buildMusicContext(input: {
    clientVersion: string;
    visitorData?: string;
    hl?: string;
    gl?: string;
    originalUrl: string;
  }): Record<string, unknown> {
    return {
      client: {
        clientName: YTM_CLIENT_NAME,
        clientVersion: input.clientVersion,
        hl: input.hl ?? "en",
        gl: input.gl ?? "US",
        visitorData: input.visitorData,
        userAgent: YTM_USER_AGENT,
        browserName: "Chrome",
        browserVersion: "136.0.0.0",
        osName: "Macintosh",
        osVersion: "10_15_7",
        platform: "DESKTOP",
        clientFormFactor: "UNKNOWN_FORM_FACTOR",
        originalUrl: input.originalUrl,
      },
      user: {
        lockedSafetyMode: false,
      },
      request: {
        useSsl: true,
      },
    };
  }

  private async getAuthCookieValue(client: SessionHttpClient): Promise<string | undefined> {
    return (
      (await client.getCookieValue("SAPISID", YTM_HOME)) ??
      (await client.getCookieValue("__Secure-3PAPISID", YTM_HOME)) ??
      (await client.getCookieValue("APISID", YTM_HOME)) ??
      (await client.getCookieValue("__Secure-1PAPISID", YTM_HOME))
    );
  }

  private extractSearchResults(
    response: Record<string, unknown>,
    filterType?: YouTubeMusicSearchType,
  ): YouTubeMusicSearchItem[] {
    const results: YouTubeMusicSearchItem[] = [];
    const seen = new Set<string>();

    this.walkForResults(response, results, seen, {
      filterType,
    });

    return results;
  }

  private extractRelatedResults(response: Record<string, unknown>, targetVideoId: string): YouTubeMusicSearchItem[] {
    const results: YouTubeMusicSearchItem[] = [];
    const seen = new Set<string>();

    this.walkForResults(response, results, seen, {
      skipVideoId: targetVideoId,
    });

    return results;
  }

  private walkForResults(
    node: unknown,
    results: YouTubeMusicSearchItem[],
    seen: Set<string>,
    options: {
      filterType?: YouTubeMusicSearchType;
      skipVideoId?: string;
    },
  ): void {
    if (node == null) {
      return;
    }

    if (Array.isArray(node)) {
      for (const entry of node) {
        this.walkForResults(entry, results, seen, options);
      }
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    if ("musicCardShelfRenderer" in node) {
      const item = this.parseMusicCardShelfRenderer((node as { musicCardShelfRenderer?: unknown }).musicCardShelfRenderer);
      this.pushMusicItem(results, seen, item, options);
      return;
    }

    if ("musicResponsiveListItemRenderer" in node) {
      const item = this.parseMusicResponsiveListItemRenderer(
        (node as { musicResponsiveListItemRenderer?: unknown }).musicResponsiveListItemRenderer,
      );
      this.pushMusicItem(results, seen, item, options);
      return;
    }

    if ("musicTwoRowItemRenderer" in node) {
      const item = this.parseMusicTwoRowItemRenderer((node as { musicTwoRowItemRenderer?: unknown }).musicTwoRowItemRenderer);
      this.pushMusicItem(results, seen, item, options);
      return;
    }

    if ("playlistPanelVideoRenderer" in node) {
      const item = this.parsePlaylistPanelVideoRenderer(
        (node as { playlistPanelVideoRenderer?: unknown }).playlistPanelVideoRenderer,
      );
      this.pushMusicItem(results, seen, item, options);
      return;
    }

    if ("automixPreviewVideoRenderer" in node) {
      const item = this.parseAutomixPreviewVideoRenderer(
        (node as { automixPreviewVideoRenderer?: unknown }).automixPreviewVideoRenderer,
      );
      this.pushMusicItem(results, seen, item, options);
      return;
    }

    for (const value of Object.values(node)) {
      this.walkForResults(value, results, seen, options);
    }
  }

  private pushMusicItem(
    results: YouTubeMusicSearchItem[],
    seen: Set<string>,
    item: YouTubeMusicSearchItem | undefined,
    options: {
      filterType?: YouTubeMusicSearchType;
      skipVideoId?: string;
    },
  ): void {
    if (!item) {
      return;
    }

    if (options.filterType && item.type !== options.filterType) {
      return;
    }

    if (options.skipVideoId && item.id === options.skipVideoId) {
      return;
    }

    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    results.push(item);
  }

  private parseMusicCardShelfRenderer(renderer: unknown): YouTubeMusicSearchItem | undefined {
    if (!renderer || typeof renderer !== "object") {
      return undefined;
    }

    const title = this.extractTextValue("title" in renderer ? renderer.title : undefined);
    const subtitle = this.extractTextValue("subtitle" in renderer ? renderer.subtitle : undefined);
    const navigationEndpoint = this.firstRunEndpoint("title" in renderer ? renderer.title : undefined);
    return this.buildMusicItemFromEndpoint(title, subtitle, navigationEndpoint, "musicCardShelfRenderer" in renderer ? renderer : undefined);
  }

  private parseMusicResponsiveListItemRenderer(renderer: unknown): YouTubeMusicSearchItem | undefined {
    if (!renderer || typeof renderer !== "object") {
      return undefined;
    }

    const flexColumns = "flexColumns" in renderer && Array.isArray(renderer.flexColumns) ? renderer.flexColumns : [];
    const primaryTextNode =
      flexColumns[0] &&
      typeof flexColumns[0] === "object" &&
      "musicResponsiveListItemFlexColumnRenderer" in flexColumns[0]
        ? (flexColumns[0] as { musicResponsiveListItemFlexColumnRenderer?: { text?: unknown } }).musicResponsiveListItemFlexColumnRenderer?.text
        : undefined;
    const flexTexts = flexColumns
      .map((column) =>
        column && typeof column === "object" && "musicResponsiveListItemFlexColumnRenderer" in column
          ? this.extractTextValue(
              (column as { musicResponsiveListItemFlexColumnRenderer?: { text?: unknown } }).musicResponsiveListItemFlexColumnRenderer?.text,
            )
          : undefined,
      )
      .filter((value): value is string => Boolean(value));
    const fixedColumns = "fixedColumns" in renderer && Array.isArray(renderer.fixedColumns) ? renderer.fixedColumns : [];
    const fixedTexts = fixedColumns
      .map((column) =>
        column && typeof column === "object" && "musicResponsiveListItemFixedColumnRenderer" in column
          ? this.extractTextValue(
              (column as { musicResponsiveListItemFixedColumnRenderer?: { text?: unknown } }).musicResponsiveListItemFixedColumnRenderer?.text,
            )
          : undefined,
      )
      .filter((value): value is string => Boolean(value));

    const title = flexTexts[0];
    const subtitle = flexTexts.slice(1).join(" • ") || undefined;
    const detail = fixedTexts.join(" • ") || undefined;
    const overlayEndpoint =
      "overlay" in renderer &&
      renderer.overlay &&
      typeof renderer.overlay === "object" &&
      "musicItemThumbnailOverlayRenderer" in renderer.overlay &&
      renderer.overlay.musicItemThumbnailOverlayRenderer &&
      typeof renderer.overlay.musicItemThumbnailOverlayRenderer === "object" &&
      "content" in renderer.overlay.musicItemThumbnailOverlayRenderer &&
      renderer.overlay.musicItemThumbnailOverlayRenderer.content &&
      typeof renderer.overlay.musicItemThumbnailOverlayRenderer.content === "object" &&
      "musicPlayButtonRenderer" in renderer.overlay.musicItemThumbnailOverlayRenderer.content &&
      renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer &&
      typeof renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer === "object" &&
      "playNavigationEndpoint" in renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer
        ? renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint
        : undefined;
    const navigationEndpoint =
      ("navigationEndpoint" in renderer ? renderer.navigationEndpoint : undefined) ??
      this.firstRunEndpoint(primaryTextNode) ??
      overlayEndpoint;

    return this.buildMusicItemFromEndpoint(
      title,
      subtitle,
      navigationEndpoint,
      renderer,
      detail,
    );
  }

  private parseMusicTwoRowItemRenderer(renderer: unknown): YouTubeMusicSearchItem | undefined {
    if (!renderer || typeof renderer !== "object") {
      return undefined;
    }

    const title = this.extractTextValue("title" in renderer ? renderer.title : undefined);
    const subtitle = this.extractTextValue("subtitle" in renderer ? renderer.subtitle : undefined);
    const navigationEndpoint =
      ("navigationEndpoint" in renderer && renderer.navigationEndpoint) || this.firstRunEndpoint("title" in renderer ? renderer.title : undefined);

    return this.buildMusicItemFromEndpoint(title, subtitle, navigationEndpoint, renderer);
  }

  private parsePlaylistPanelVideoRenderer(renderer: unknown): YouTubeMusicSearchItem | undefined {
    if (!renderer || typeof renderer !== "object") {
      return undefined;
    }

    const title = this.extractTextValue("title" in renderer ? renderer.title : undefined);
    const subtitle =
      this.extractTextValue("longBylineText" in renderer ? renderer.longBylineText : undefined) ??
      this.extractTextValue("shortBylineText" in renderer ? renderer.shortBylineText : undefined);
    const detail = this.extractTextValue("lengthText" in renderer ? renderer.lengthText : undefined);

    return this.buildMusicItemFromEndpoint(
      title,
      subtitle,
      "navigationEndpoint" in renderer ? renderer.navigationEndpoint : undefined,
      renderer,
      detail,
    );
  }

  private parseAutomixPreviewVideoRenderer(renderer: unknown): YouTubeMusicSearchItem | undefined {
    if (!renderer || typeof renderer !== "object" || !("content" in renderer) || !renderer.content || typeof renderer.content !== "object") {
      return undefined;
    }

    const automix =
      "automixPlaylistVideoRenderer" in renderer.content &&
      renderer.content.automixPlaylistVideoRenderer &&
      typeof renderer.content.automixPlaylistVideoRenderer === "object"
        ? (renderer.content.automixPlaylistVideoRenderer as Record<string, unknown>)
        : undefined;
    const watchPlaylistEndpoint =
      automix &&
      "navigationEndpoint" in automix &&
      automix.navigationEndpoint &&
      typeof automix.navigationEndpoint === "object" &&
      "watchPlaylistEndpoint" in automix.navigationEndpoint &&
      automix.navigationEndpoint.watchPlaylistEndpoint &&
      typeof automix.navigationEndpoint.watchPlaylistEndpoint === "object"
        ? (automix.navigationEndpoint.watchPlaylistEndpoint as Record<string, unknown>)
        : undefined;
    const playlistId =
      watchPlaylistEndpoint && "playlistId" in watchPlaylistEndpoint && typeof watchPlaylistEndpoint.playlistId === "string"
        ? watchPlaylistEndpoint.playlistId
        : undefined;

    if (!playlistId) {
      return undefined;
    }

    return {
      type: "playlist",
      id: `VL${playlistId}`.replace(/^VLVL/, "VL"),
      title: "Automix",
      subtitle: "Generated mix based on the current track",
      url: this.buildPlaylistUrl(playlistId),
      thumbnailUrl: this.extractNestedThumbnailUrl(renderer),
    };
  }

  private buildMusicItemFromEndpoint(
    title: string | undefined,
    subtitle: string | undefined,
    navigationEndpoint: unknown,
    renderer: unknown,
    detail?: string,
  ): YouTubeMusicSearchItem | undefined {
    if (!title) {
      return undefined;
    }

    const endpoint = navigationEndpoint && typeof navigationEndpoint === "object" ? navigationEndpoint : undefined;
    const watchEndpoint =
      endpoint && "watchEndpoint" in endpoint && endpoint.watchEndpoint && typeof endpoint.watchEndpoint === "object"
        ? (endpoint.watchEndpoint as Record<string, unknown>)
        : undefined;
    const browseEndpoint =
      endpoint && "browseEndpoint" in endpoint && endpoint.browseEndpoint && typeof endpoint.browseEndpoint === "object"
        ? (endpoint.browseEndpoint as Record<string, unknown>)
        : undefined;

    const subtitleParts = subtitle
      ?.split(" • ")
      .map((part) => part.trim())
      .filter(Boolean) ?? [];
    const firstSubtitleLabel = subtitleParts[0];
    const type = this.normalizeItemType(firstSubtitleLabel, watchEndpoint, browseEndpoint);
    if (!type) {
      return undefined;
    }

    const videoId =
      watchEndpoint && "videoId" in watchEndpoint && typeof watchEndpoint.videoId === "string" ? watchEndpoint.videoId : undefined;
    const playlistId =
      watchEndpoint && "playlistId" in watchEndpoint && typeof watchEndpoint.playlistId === "string" ? watchEndpoint.playlistId : undefined;
    const browseId =
      browseEndpoint && "browseId" in browseEndpoint && typeof browseEndpoint.browseId === "string" ? browseEndpoint.browseId : undefined;

    const id = browseId ?? videoId ?? playlistId;
    if (!id) {
      return undefined;
    }

    const url = browseId
      ? `${YTM_ORIGIN}/browse/${browseId}`
      : videoId
        ? this.buildWatchUrl(videoId, playlistId)
        : `${YTM_ORIGIN}/playlist?list=${encodeURIComponent(playlistId!)}`;

    const meta = this.isTypeLabel(firstSubtitleLabel) ? subtitleParts.slice(1) : subtitleParts;
    return {
      type,
      id,
      title,
      subtitle: meta.length > 0 ? meta.join(" • ") : undefined,
      detail,
      url,
      thumbnailUrl: this.extractNestedThumbnailUrl(renderer),
    };
  }

  private normalizeItemType(
    label: string | undefined,
    watchEndpoint: Record<string, unknown> | undefined,
    browseEndpoint: Record<string, unknown> | undefined,
  ): YouTubeMusicItemType | undefined {
    const normalizedLabel = label?.trim().toLowerCase();
    switch (normalizedLabel) {
      case "song":
        return "song";
      case "video":
        return "video";
      case "album":
      case "single":
      case "ep":
        return "album";
      case "artist":
        return "artist";
      case "playlist":
      case "community playlist":
      case "featured playlist":
        return "playlist";
      default:
        break;
    }

    const pageType =
      browseEndpoint &&
      "browseEndpointContextSupportedConfigs" in browseEndpoint &&
      browseEndpoint.browseEndpointContextSupportedConfigs &&
      typeof browseEndpoint.browseEndpointContextSupportedConfigs === "object" &&
      "browseEndpointContextMusicConfig" in browseEndpoint.browseEndpointContextSupportedConfigs &&
      browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig &&
      typeof browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig === "object" &&
      "pageType" in browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig &&
      typeof browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType === "string"
        ? browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType
        : undefined;

    switch (pageType) {
      case "MUSIC_PAGE_TYPE_ALBUM":
        return "album";
      case "MUSIC_PAGE_TYPE_ARTIST":
        return "artist";
      case "MUSIC_PAGE_TYPE_PLAYLIST":
      case "MUSIC_PAGE_TYPE_USER_CHANNEL":
        return "playlist";
      default:
        break;
    }

    const musicVideoType =
      watchEndpoint &&
      "watchEndpointMusicSupportedConfigs" in watchEndpoint &&
      watchEndpoint.watchEndpointMusicSupportedConfigs &&
      typeof watchEndpoint.watchEndpointMusicSupportedConfigs === "object" &&
      "watchEndpointMusicConfig" in watchEndpoint.watchEndpointMusicSupportedConfigs &&
      watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig &&
      typeof watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig === "object" &&
      "musicVideoType" in watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig &&
      typeof watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType === "string"
        ? watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType
        : undefined;

    if (musicVideoType === "MUSIC_VIDEO_TYPE_OMV" || musicVideoType === "MUSIC_VIDEO_TYPE_UGC") {
      return "video";
    }

    if (musicVideoType) {
      return "song";
    }

    return undefined;
  }

  private isTypeLabel(label: string | undefined): boolean {
    const normalized = label?.trim().toLowerCase();
    return normalized === "song" || normalized === "video" || normalized === "album" || normalized === "single" || normalized === "ep" || normalized === "artist" || normalized === "playlist" || normalized === "community playlist" || normalized === "featured playlist";
  }

  private firstRunEndpoint(node: unknown): unknown {
    if (!node || typeof node !== "object" || !("runs" in node) || !Array.isArray(node.runs)) {
      return undefined;
    }

    for (const entry of node.runs) {
      if (!entry || typeof entry !== "object" || !("navigationEndpoint" in entry)) {
        continue;
      }

      return entry.navigationEndpoint;
    }

    return undefined;
  }

  private parseInfoResponse(response: Record<string, unknown>, videoId: string, url: string): YouTubeMusicInfo {
    const playabilityStatus =
      "playabilityStatus" in response && response.playabilityStatus && typeof response.playabilityStatus === "object"
        ? response.playabilityStatus
        : undefined;
    const status =
      playabilityStatus && "status" in playabilityStatus && typeof playabilityStatus.status === "string"
        ? playabilityStatus.status
        : undefined;

    if (status && status !== "OK") {
      const reason =
        playabilityStatus && "reason" in playabilityStatus && typeof playabilityStatus.reason === "string"
          ? playabilityStatus.reason
          : "YouTube Music item unavailable";
      throw new AutoCliError("YTMUSIC_ITEM_UNAVAILABLE", reason, {
        details: {
          videoId,
          playabilityStatus: status,
        },
      });
    }

    const videoDetails =
      "videoDetails" in response && response.videoDetails && typeof response.videoDetails === "object"
        ? response.videoDetails
        : undefined;
    if (!videoDetails) {
      throw new AutoCliError("YTMUSIC_INFO_MISSING", "YouTube Music did not return item details.", {
        details: { videoId },
      });
    }

    const durationSeconds =
      "lengthSeconds" in videoDetails && typeof videoDetails.lengthSeconds === "string"
        ? Number.parseInt(videoDetails.lengthSeconds, 10)
        : undefined;

    return {
      id: videoId,
      title:
        "title" in videoDetails && typeof videoDetails.title === "string" ? videoDetails.title : "Untitled item",
      url,
      artists:
        "author" in videoDetails && typeof videoDetails.author === "string" ? videoDetails.author : undefined,
      duration:
        typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
          ? formatDuration(durationSeconds)
          : undefined,
      description:
        "shortDescription" in videoDetails && typeof videoDetails.shortDescription === "string"
          ? videoDetails.shortDescription
          : undefined,
      thumbnailUrl: this.extractThumbnailUrl("thumbnail" in videoDetails ? videoDetails.thumbnail : undefined),
    };
  }

  private parseBrowseResponse(
    response: Record<string, unknown>,
    input: {
      browseId: string;
      canonicalTarget?: string;
      type: "album" | "artist" | "playlist";
      fallbackUrl: string;
      limit: number;
    },
  ): YouTubeMusicBrowseInfo {
    const metadata = this.extractBrowseMetadata(response);
    const sections = this.extractBrowseSections(response, input.limit);
    const collectionResults = input.type === "artist" ? undefined : this.extractCollectionResults(response, input.limit);
    const flattenedResults = sections.flatMap((section) => section.results);
    const primaryResults =
      input.type === "artist"
        ? undefined
        : (collectionResults && collectionResults.length > 0
            ? collectionResults
            : (sections.find((section) => section.results.length > 0)?.results ?? flattenedResults)
          ).slice(0, input.limit);
    const itemCount = primaryResults?.length ?? flattenedResults.length;

    return {
      id: input.browseId,
      type: input.type,
      title: metadata.title ?? `${capitalize(input.type)} ${input.browseId}`,
      url: metadata.url ?? input.fallbackUrl,
      subtitle: metadata.subtitle,
      description: metadata.description,
      thumbnailUrl: metadata.thumbnailUrl,
      itemCount: itemCount > 0 ? itemCount : undefined,
      ...(primaryResults && primaryResults.length > 0 ? { results: primaryResults } : {}),
      ...(input.type === "artist" && sections.length > 0 ? { sections } : {}),
    };
  }

  private extractBrowseMetadata(response: Record<string, unknown>): {
    title?: string;
    subtitle?: string;
    description?: string;
    url?: string;
    thumbnailUrl?: string;
  } {
    const header =
      "header" in response && response.header && typeof response.header === "object"
        ? (response.header as Record<string, unknown>)
        : undefined;
    const microformatRoot =
      "microformat" in response && response.microformat && typeof response.microformat === "object"
        ? (response.microformat as Record<string, unknown>)
        : undefined;
    const microformat =
      microformatRoot &&
      "microformatDataRenderer" in microformatRoot &&
      microformatRoot.microformatDataRenderer &&
      typeof microformatRoot.microformatDataRenderer === "object"
        ? (microformatRoot.microformatDataRenderer as Record<string, unknown>)
        : undefined;

    const responsiveHeader =
      header &&
      "musicResponsiveHeaderRenderer" in header &&
      header.musicResponsiveHeaderRenderer &&
      typeof header.musicResponsiveHeaderRenderer === "object"
        ? (header.musicResponsiveHeaderRenderer as Record<string, unknown>)
        : undefined;
    const immersiveHeader =
      header &&
      "musicImmersiveHeaderRenderer" in header &&
      header.musicImmersiveHeaderRenderer &&
      typeof header.musicImmersiveHeaderRenderer === "object"
        ? (header.musicImmersiveHeaderRenderer as Record<string, unknown>)
        : undefined;

    const subtitleParts = [
      this.extractTextValue(responsiveHeader && "subtitle" in responsiveHeader ? responsiveHeader.subtitle : undefined),
      this.extractTextValue(responsiveHeader && "straplineTextOne" in responsiveHeader ? responsiveHeader.straplineTextOne : undefined),
      this.extractTextValue(responsiveHeader && "straplineTextTwo" in responsiveHeader ? responsiveHeader.straplineTextTwo : undefined),
      this.extractSubscriberCountText(immersiveHeader),
    ].filter((value): value is string => Boolean(value));

    return {
      title:
        this.extractTextValue(responsiveHeader && "title" in responsiveHeader ? responsiveHeader.title : undefined) ??
        this.extractTextValue(immersiveHeader && "title" in immersiveHeader ? immersiveHeader.title : undefined) ??
        (microformat && "title" in microformat && typeof microformat.title === "string" ? microformat.title : undefined),
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(" • ") : undefined,
      description:
        this.extractTextValue(responsiveHeader && "description" in responsiveHeader ? responsiveHeader.description : undefined) ??
        (microformat && "description" in microformat && typeof microformat.description === "string"
          ? microformat.description
          : undefined),
      url: microformat && "urlCanonical" in microformat && typeof microformat.urlCanonical === "string" ? microformat.urlCanonical : undefined,
      thumbnailUrl: this.extractThumbnailUrl(microformat && "thumbnail" in microformat ? microformat.thumbnail : undefined),
    };
  }

  private extractBrowseSections(
    response: Record<string, unknown>,
    limit: number,
  ): Array<{
    title?: string;
    results: YouTubeMusicSearchItem[];
  }> {
    const sections: Array<{
      title?: string;
      results: YouTubeMusicSearchItem[];
    }> = [];

    const appendSection = (title: string | undefined, contents: unknown) => {
      const results = this.extractItemsFromNode(contents).slice(0, limit);
      if (results.length === 0) {
        return;
      }

      sections.push({ title, results });
    };

    const walk = (node: unknown): void => {
      if (node == null) {
        return;
      }

      if (Array.isArray(node)) {
        for (const entry of node) {
          walk(entry);
        }
        return;
      }

      if (typeof node !== "object") {
        return;
      }

      if ("musicShelfRenderer" in node) {
        const renderer =
          (node as { musicShelfRenderer?: unknown }).musicShelfRenderer && typeof (node as { musicShelfRenderer?: unknown }).musicShelfRenderer === "object"
            ? ((node as { musicShelfRenderer?: Record<string, unknown> }).musicShelfRenderer as Record<string, unknown>)
            : undefined;
        if (renderer) {
          appendSection(this.extractSectionTitle(renderer), "contents" in renderer ? renderer.contents : undefined);
        }
      }

      if ("musicPlaylistShelfRenderer" in node) {
        const renderer =
          (node as { musicPlaylistShelfRenderer?: unknown }).musicPlaylistShelfRenderer &&
          typeof (node as { musicPlaylistShelfRenderer?: unknown }).musicPlaylistShelfRenderer === "object"
            ? ((node as { musicPlaylistShelfRenderer?: Record<string, unknown> }).musicPlaylistShelfRenderer as Record<string, unknown>)
            : undefined;
        if (renderer) {
          appendSection(this.extractSectionTitle(renderer), "contents" in renderer ? renderer.contents : undefined);
        }
      }

      if ("musicCarouselShelfRenderer" in node) {
        const renderer =
          (node as { musicCarouselShelfRenderer?: unknown }).musicCarouselShelfRenderer &&
          typeof (node as { musicCarouselShelfRenderer?: unknown }).musicCarouselShelfRenderer === "object"
            ? ((node as { musicCarouselShelfRenderer?: Record<string, unknown> }).musicCarouselShelfRenderer as Record<string, unknown>)
            : undefined;
        if (renderer) {
          appendSection(this.extractSectionTitle(renderer), "contents" in renderer ? renderer.contents : undefined);
        }
      }

      for (const value of Object.values(node)) {
        walk(value);
      }
    };

    walk(response.contents ?? response);
    return dedupeSections(sections);
  }

  private extractCollectionResults(response: Record<string, unknown>, limit: number): YouTubeMusicSearchItem[] {
    const contentsRoot =
      "contents" in response && response.contents && typeof response.contents === "object"
        ? (response.contents as Record<string, unknown>)
        : undefined;
    const twoColumn =
      contentsRoot &&
      "twoColumnBrowseResultsRenderer" in contentsRoot &&
      contentsRoot.twoColumnBrowseResultsRenderer &&
      typeof contentsRoot.twoColumnBrowseResultsRenderer === "object"
        ? (contentsRoot.twoColumnBrowseResultsRenderer as Record<string, unknown>)
        : undefined;
    const secondaryContents =
      twoColumn &&
      "secondaryContents" in twoColumn &&
      twoColumn.secondaryContents &&
      typeof twoColumn.secondaryContents === "object"
        ? (twoColumn.secondaryContents as Record<string, unknown>)
        : undefined;
    const sectionList =
      secondaryContents &&
      "sectionListRenderer" in secondaryContents &&
      secondaryContents.sectionListRenderer &&
      typeof secondaryContents.sectionListRenderer === "object"
        ? (secondaryContents.sectionListRenderer as Record<string, unknown>)
        : undefined;
    const sections = sectionList && "contents" in sectionList && Array.isArray(sectionList.contents) ? sectionList.contents : [];

    for (const section of sections) {
      if (!section || typeof section !== "object") {
        continue;
      }

      if ("musicShelfRenderer" in section && section.musicShelfRenderer && typeof section.musicShelfRenderer === "object") {
        const renderer = section.musicShelfRenderer as Record<string, unknown>;
        const results = this.extractItemsFromNode("contents" in renderer ? renderer.contents : undefined).slice(0, limit);
        if (results.length > 0) {
          return results;
        }
      }

      if (
        "musicPlaylistShelfRenderer" in section &&
        section.musicPlaylistShelfRenderer &&
        typeof section.musicPlaylistShelfRenderer === "object"
      ) {
        const renderer = section.musicPlaylistShelfRenderer as Record<string, unknown>;
        const results = this.extractItemsFromNode("contents" in renderer ? renderer.contents : undefined).slice(0, limit);
        if (results.length > 0) {
          return results;
        }
      }
    }

    return [];
  }

  private extractItemsFromNode(node: unknown): YouTubeMusicSearchItem[] {
    const results: YouTubeMusicSearchItem[] = [];
    const seen = new Set<string>();
    this.walkForResults(node, results, seen, {});
    return results;
  }

  private async loadPublicYouTubeInfo(videoId: string, musicUrl: string): Promise<YouTubeMusicInfo> {
    const html = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      headers: {
        "user-agent": YTM_USER_AGENT,
        referer: "https://www.youtube.com/",
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new AutoCliError("HTTP_REQUEST_FAILED", `Request failed with ${response.status} ${response.statusText}`, {
          details: {
            url: response.url,
            status: response.status,
            statusText: response.statusText,
          },
        });
      }

      return response.text();
    });

    const playerResponse = this.extractAssignedJsonObject(html, "ytInitialPlayerResponse");
    return this.parseInfoResponse(playerResponse, videoId, musicUrl);
  }

  private extractLikeStatus(response: Record<string, unknown>): string | undefined {
    const frameworkUpdates =
      "frameworkUpdates" in response && response.frameworkUpdates && typeof response.frameworkUpdates === "object"
        ? response.frameworkUpdates
        : undefined;
    const entityBatchUpdate =
      frameworkUpdates &&
      "entityBatchUpdate" in frameworkUpdates &&
      frameworkUpdates.entityBatchUpdate &&
      typeof frameworkUpdates.entityBatchUpdate === "object"
        ? frameworkUpdates.entityBatchUpdate
        : undefined;
    const mutations =
      entityBatchUpdate && "mutations" in entityBatchUpdate && Array.isArray(entityBatchUpdate.mutations)
        ? entityBatchUpdate.mutations
        : [];

    for (const mutation of mutations) {
      if (!mutation || typeof mutation !== "object" || !("payload" in mutation)) {
        continue;
      }

      const payload = mutation.payload;
      if (!payload || typeof payload !== "object" || !("likeStatusEntity" in payload)) {
        continue;
      }

      const likeStatusEntity = payload.likeStatusEntity;
      if (
        likeStatusEntity &&
        typeof likeStatusEntity === "object" &&
        "likeStatus" in likeStatusEntity &&
        typeof likeStatusEntity.likeStatus === "string"
      ) {
        return likeStatusEntity.likeStatus;
      }
    }

    return undefined;
  }

  private extractTextValue(node: unknown): string | undefined {
    if (!node || typeof node !== "object") {
      return typeof node === "string" ? node : undefined;
    }

    if ("content" in node && typeof node.content === "string") {
      return node.content;
    }

    if ("simpleText" in node && typeof node.simpleText === "string") {
      return node.simpleText;
    }

    if ("runs" in node && Array.isArray(node.runs)) {
      const text = node.runs
        .map((entry) =>
          entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string" ? entry.text : "",
        )
        .filter(Boolean)
        .join("");
      return text || undefined;
    }

    return undefined;
  }

  private extractSectionTitle(node: unknown): string | undefined {
    if (!node || typeof node !== "object") {
      return undefined;
    }

    const directTitle = this.extractTextValue("title" in node ? node.title : undefined);
    if (directTitle) {
      return directTitle;
    }

    const header =
      "header" in node && node.header && typeof node.header === "object" ? (node.header as Record<string, unknown>) : undefined;
    if (!header) {
      return undefined;
    }

    return (
      this.extractTextValue(header) ??
      this.extractTextValue(
        "musicCarouselShelfBasicHeaderRenderer" in header &&
          header.musicCarouselShelfBasicHeaderRenderer &&
          typeof header.musicCarouselShelfBasicHeaderRenderer === "object"
          ? (header.musicCarouselShelfBasicHeaderRenderer as Record<string, unknown>).title
          : undefined,
      ) ??
      this.extractTextValue(
        "musicSideAlignedItemRenderer" in header &&
          header.musicSideAlignedItemRenderer &&
          typeof header.musicSideAlignedItemRenderer === "object"
          ? (header.musicSideAlignedItemRenderer as Record<string, unknown>).title
          : undefined,
      )
    );
  }

  private extractSubscriberCountText(header: Record<string, unknown> | undefined): string | undefined {
    if (!header || !("subscriptionButton" in header) || !header.subscriptionButton || typeof header.subscriptionButton !== "object") {
      return undefined;
    }

    const subscribeButton =
      "subscribeButtonRenderer" in header.subscriptionButton &&
      header.subscriptionButton.subscribeButtonRenderer &&
      typeof header.subscriptionButton.subscribeButtonRenderer === "object"
        ? (header.subscriptionButton.subscribeButtonRenderer as Record<string, unknown>)
        : undefined;

    return (
      this.extractTextValue(subscribeButton && "longSubscriberCountText" in subscribeButton ? subscribeButton.longSubscriberCountText : undefined) ??
      this.extractTextValue(subscribeButton && "subscriberCountText" in subscribeButton ? subscribeButton.subscriberCountText : undefined)
    );
  }

  private extractThumbnailUrl(node: unknown): string | undefined {
    if (!node || typeof node !== "object" || !("thumbnails" in node) || !Array.isArray(node.thumbnails)) {
      return undefined;
    }

    const thumbnails = node.thumbnails.filter(
      (entry): entry is { url: string } => Boolean(entry && typeof entry === "object" && "url" in entry && typeof entry.url === "string"),
    );

    return thumbnails.at(-1)?.url;
  }

  private extractNestedThumbnailUrl(node: unknown): string | undefined {
    if (!node || typeof node !== "object") {
      return undefined;
    }

    if ("thumbnail" in node) {
      const direct = this.extractThumbnailUrl(node.thumbnail);
      if (direct) {
        return direct;
      }
    }

    for (const value of Object.values(node)) {
      const nested = this.extractNestedThumbnailUrl(value);
      if (nested) {
        return nested;
      }
    }

    return undefined;
  }

  private extractAssignedJsonObject(html: string, variableName: string): Record<string, unknown> {
    const patterns = [`var ${variableName} = `, `${variableName} = `];
    for (const marker of patterns) {
      const markerIndex = html.indexOf(marker);
      if (markerIndex === -1) {
        continue;
      }

      const objectStart = html.indexOf("{", markerIndex + marker.length);
      if (objectStart === -1) {
        continue;
      }

      const objectText = this.readBalancedJsonObject(html, objectStart);
      if (!objectText) {
        continue;
      }

      return JSON.parse(objectText) as Record<string, unknown>;
    }

    throw new AutoCliError("YTMUSIC_PAGE_CONFIG_MISSING", `Missing ${variableName} from the page response.`);
  }

  private readBalancedJsonObject(source: string, startIndex: number): string | undefined {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < source.length; index += 1) {
      const character = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (character === "\\") {
          escaped = true;
          continue;
        }

        if (character === "\"") {
          inString = false;
        }

        continue;
      }

      if (character === "\"") {
        inString = true;
        continue;
      }

      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.slice(startIndex, index + 1);
        }
      }
    }

    return undefined;
  }

  private mapWriteError(error: unknown, fallbackMessage: string): AutoCliError {
    if (isAutoCliError(error) && (error.code === "YTMUSIC_REQUEST_REJECTED" || error.code === "YTMUSIC_ITEM_UNAVAILABLE")) {
      return error;
    }

    if (isAutoCliError(error) && error.code === "HTTP_REQUEST_FAILED") {
      const status = typeof error.details?.status === "number" ? error.details.status : undefined;

      if (status === 400) {
        return new AutoCliError(
          "YTMUSIC_REQUEST_REJECTED",
          "YouTube Music rejected this action request. The item may not allow this action, or the saved cookies need a fresh export.",
          {
            cause: error,
            details: error.details,
          },
        );
      }

      if (status === 401 || status === 403) {
        return new AutoCliError(
          "SESSION_EXPIRED",
          "YouTube Music rejected the saved session for this action. Re-export cookies from an active browser session.",
          {
            cause: error,
            details: error.details,
          },
        );
      }
    }

    return new AutoCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details:
        isAutoCliError(error) && error.details
          ? error.details
          : error instanceof Error
            ? { message: error.message }
            : undefined,
    });
  }

  private async persistSessionState(session: PlatformSession, probe: YouTubeMusicProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async filterYouTubeMusicCookies(sourceJar: CookieJar): Promise<CookieJar> {
    const filteredJar = new CookieJar();
    const cookies = await sourceJar.getCookies(YTM_HOME);

    for (const cookie of cookies) {
      if (!YTM_COOKIE_ALLOWLIST.has(cookie.key)) {
        continue;
      }

      const normalized = Cookie.fromJSON(cookie.toJSON());
      if (!normalized) {
        continue;
      }

      await filteredJar.setCookie(normalized, `https://${cookie.domain}${cookie.path || "/"}`, {
        ignoreError: true,
      });
    }

    return filteredJar;
  }

  private async requireCommand(
    command: string,
    args: string[],
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.runProcess(command, args);
    } catch (error) {
      if (
        error instanceof Error &&
        "cause" in error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause &&
        error.cause.code === "ENOENT"
      ) {
        throw new AutoCliError(errorCode, errorMessage, {
          details: {
            command,
          },
          cause: error,
        });
      }

      throw error;
    }
  }

  private async runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => {
        rejectPromise(new Error(`Failed to start ${command}.`, { cause: error }));
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }

        rejectPromise(
          new AutoCliError("PROCESS_FAILED", `${command} exited with code ${code ?? "unknown"}.`, {
            details: {
              command,
              args,
              code: code ?? undefined,
              stderr: stderr.trim() || undefined,
            },
          }),
        );
      });
    });
  }
}

function buildSapisidHash(sapisid: string, origin: string): string {
  const timestamp = Math.floor(Date.now() / 1_000);
  const digest = createHash("sha1").update(`${timestamp} ${sapisid} ${origin}`).digest("hex");
  return `SAPISIDHASH ${timestamp}_${digest}`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseDurationToMs(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value
    .trim()
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return undefined;
  }

  if (parts.length === 3) {
    return ((parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)) * 1_000;
  }

  if (parts.length === 2) {
    return ((parts[0] ?? 0) * 60 + (parts[1] ?? 0)) * 1_000;
  }

  if (parts.length === 1) {
    return (parts[0] ?? 0) * 1_000;
  }

  return undefined;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}

function dedupeSections(
  sections: Array<{
    title?: string;
    results: YouTubeMusicSearchItem[];
  }>,
): Array<{
  title?: string;
  results: YouTubeMusicSearchItem[];
}> {
  const seen = new Set<string>();
  const deduped: Array<{
    title?: string;
    results: YouTubeMusicSearchItem[];
  }> = [];

  for (const section of sections) {
    const key = `${section.title ?? ""}:${section.results.map((item) => `${item.type}:${item.id}`).join(",")}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(section);
  }

  return deduped;
}
