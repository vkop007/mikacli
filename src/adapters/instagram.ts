import { randomUUID } from "node:crypto";

import { AutoCliError } from "../errors.js";
import { maybeAutoRefreshSession } from "../utils/autorefresh.js";
import { serializeCookieJar } from "../utils/cookie-manager.js";
import { readMediaFile } from "../utils/media.js";
import { parseInstagramTarget } from "../utils/targets.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../platforms.js";
import { BasePlatformAdapter } from "./base.js";

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
} from "../types.js";

const INSTAGRAM_ORIGIN = getPlatformOrigin("instagram");
const INSTAGRAM_HOME = getPlatformHomeUrl("instagram");
const INSTAGRAM_APP_ID = "936619743392459";
const INSTAGRAM_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface InstagramProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

interface InstagramCurrentUserResponse {
  status?: string;
  user?: {
    pk?: string | number;
    username?: string;
    full_name?: string;
  };
  form_data?: {
    username?: string;
    first_name?: string;
  };
}

interface InstagramMutationResponse {
  status?: string;
  feedback_message?: string;
  media?: {
    id?: string;
    code?: string;
  };
}

export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = "instagram" as const;

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
    const account = input.account ?? probe.user?.username ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Instagram session has expired.", {
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
          ? `Saved Instagram session for ${account}.`
          : `Saved Instagram session for ${account}, but it should be revalidated before heavy use.`,
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
      user: probe.user,
    });
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const media = await readMediaFile(input.mediaPath);
    const client = await this.createInstagramClient(session);
    const uploadId = `${Date.now()}`;
    const entityName = `${uploadId}_0_${randomUUID()}`;

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/rupload_igphoto/${uploadId}`, {
            method: "POST",
            responseType: "text",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/octet-stream",
              offset: "0",
              "x-entity-name": entityName,
              "x-entity-type": media.mimeType,
              "x-entity-length": String(media.bytes.length),
              "x-instagram-rupload-params": JSON.stringify({
                media_type: 1,
                upload_id: uploadId,
                upload_media_width: 1080,
                upload_media_height: 1350,
                image_compression: JSON.stringify({
                  lib_name: "moz",
                  lib_version: "3.1.m",
                  quality: "80",
                }),
              }),
              referer: `${INSTAGRAM_ORIGIN}/create/style/`,
            },
            body: new Uint8Array(media.bytes),
          }),
      ],
      "Failed to upload media to Instagram. The private web upload flow may have changed.",
    );

    const configureResponse = await this.tryRequestChain<InstagramMutationResponse>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/media/configure/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
              referer: `${INSTAGRAM_ORIGIN}/create/details/`,
            },
            body: new URLSearchParams({
              upload_id: uploadId,
              caption: input.caption ?? "",
              source_type: "library",
              timezone_offset: "0",
              disable_comments: "0",
              like_and_view_counts_disabled: "0",
            }),
          }),
      ],
      "Failed to configure the Instagram post after upload.",
    );

    const postId = configureResponse.media?.id ?? uploadId;
    const shortcode = configureResponse.media?.code;
    const url = shortcode ? `${INSTAGRAM_ORIGIN}/p/${shortcode}/` : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "post",
      message: `Instagram post created for ${session.account}.`,
      id: postId,
      url,
      user: probe.user,
      data: {
        caption: input.caption ?? "",
        mediaPath: input.mediaPath,
      },
    };
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "Instagram web sessions cannot publish a text-only post. Use `autocli instagram post <media-path> --caption ...`.",
    );
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/likes/${target.mediaId}/like/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/likes/${target.mediaId}/like/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
      ],
      "Failed to like the Instagram post.",
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `Instagram post liked for ${session.account}.`,
      id: target.mediaId,
      user: probe.user,
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/comments/${target.mediaId}/add/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              comment_text: input.text,
            }),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/comments/${target.mediaId}/add/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              comment_text: input.text,
            }),
          }),
      ],
      "Failed to comment on the Instagram post.",
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `Instagram comment sent for ${session.account}.`,
      id: target.mediaId,
      user: probe.user,
      data: {
        text: input.text,
      },
    };
  }

  private async ensureActiveSession(session: PlatformSession): Promise<InstagramProbe> {
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Instagram session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    return probe;
  }

  private async probeSession(session: PlatformSession): Promise<InstagramProbe> {
    const client = await this.createInstagramClient(session);
    const sessionId = await client.getCookieValue("sessionid", INSTAGRAM_HOME);
    const csrfToken = await client.getCookieValue("csrftoken", INSTAGRAM_HOME);
    const dsUserId = await client.getCookieValue("ds_user_id", INSTAGRAM_HOME);

    if (!sessionId || !csrfToken) {
      return {
        status: {
          state: "expired",
          message: "Missing required Instagram session cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    const homeHtml = await client.request<string>(INSTAGRAM_HOME, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        "user-agent": INSTAGRAM_USER_AGENT,
      },
    });

    const inlineUser = this.extractUserFromHtml(homeHtml, dsUserId);
    const appId = this.extractFirst(homeHtml, /"app_id":"([^"]+)"/u) ?? INSTAGRAM_APP_ID;
    const deviceId = this.extractFirst(homeHtml, /"device_id":"([^"]+)"/u);

    const apiUser = await this.tryRequestChain<InstagramCurrentUserResponse | null>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/accounts/current_user/?edit=true`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, { appId, deviceId }),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/accounts/edit/web_form_data/`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, { appId, deviceId }),
          }),
      ],
      "",
      true,
    );

    const user: SessionUser | undefined =
      apiUser?.user
        ? {
            id: String(apiUser.user.pk ?? dsUserId ?? ""),
            username: apiUser.user.username ?? inlineUser?.username,
            displayName: apiUser.user.full_name ?? inlineUser?.displayName,
            profileUrl: apiUser.user.username ? `${INSTAGRAM_ORIGIN}/${apiUser.user.username}/` : inlineUser?.profileUrl,
          }
        : apiUser?.form_data?.username || inlineUser
          ? {
              id: dsUserId,
              username: apiUser?.form_data?.username ?? inlineUser?.username,
              displayName: apiUser?.form_data?.first_name ?? inlineUser?.displayName,
              profileUrl:
                apiUser?.form_data?.username ?? inlineUser?.username
                  ? `${INSTAGRAM_ORIGIN}/${apiUser?.form_data?.username ?? inlineUser?.username}/`
                  : undefined,
            }
          : undefined;

    if (!apiUser && !user) {
      return {
        status: {
          state: "expired",
          message: "Instagram did not expose a logged-in user for these cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "LOGGED_OUT",
        },
        metadata: {
          appId,
          deviceId,
        },
      };
    }

    return {
      status: {
        state: apiUser ? "active" : "unknown",
        message:
          apiUser
            ? "Session validated."
            : "Homepage includes logged-in user data, but the validation endpoint was unavailable.",
        lastValidatedAt: new Date().toISOString(),
      },
      user,
      metadata: {
        appId,
        deviceId,
      },
    };
  }

  private async createInstagramClient(session: PlatformSession) {
    return this.createClient(session, {
      accept: "*/*",
      origin: INSTAGRAM_ORIGIN,
      "user-agent": INSTAGRAM_USER_AGENT,
    });
  }

  private async buildInstagramHeaders(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata?: Record<string, unknown>,
  ): Promise<Record<string, string>> {
    const csrfToken = await client.getCookieValue("csrftoken", INSTAGRAM_HOME);
    return {
      accept: "*/*",
      origin: INSTAGRAM_ORIGIN,
      referer: INSTAGRAM_HOME,
      "x-asbd-id": "129477",
      "x-csrftoken": csrfToken ?? "",
      "x-ig-app-id": String(metadata?.appId ?? INSTAGRAM_APP_ID),
      "x-requested-with": "XMLHttpRequest",
    };
  }

  private extractUserFromHtml(html: string, dsUserId?: string): SessionUser | undefined {
    const username =
      this.extractFirst(html, /"username":"([^"]+)"/u) ??
      this.extractFirst(html, /"forceLoginUsername":"([^"]+)"/u);
    const displayName = this.extractFirst(html, /"full_name":"([^"]+)"/u);

    if (!username && !displayName && !dsUserId) {
      return undefined;
    }

    return {
      id: dsUserId,
      username: username ?? undefined,
      displayName: displayName ?? undefined,
      profileUrl: username ? `${INSTAGRAM_ORIGIN}/${username}/` : undefined,
    };
  }

  private extractFirst(input: string, pattern: RegExp): string | undefined {
    return input.match(pattern)?.[1];
  }

  private async prepareSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    return {
      path: loaded.path,
      session: await this.maybeAutoRefresh(loaded.session),
    };
  }

  private async maybeAutoRefresh(session: PlatformSession): Promise<PlatformSession> {
    const client = await this.createInstagramClient(session);
    const refresh = await maybeAutoRefreshSession({
      platform: this.platform,
      session,
      jar: client.jar,
      strategy: "homepage_keepalive",
      capability: "auto",
      refresh: async () => {
        await client.request<string>(INSTAGRAM_HOME, {
          responseType: "text",
          expectedStatus: 200,
          headers: {
            referer: INSTAGRAM_HOME,
          },
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

  private async persistSessionState(session: PlatformSession, probe: InstagramProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async tryRequestChain<T>(
    attempts: Array<() => Promise<T>>,
    fallbackMessage: string,
    allowNull = false,
  ): Promise<T> {
    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }

    if (allowNull) {
      return null as T;
    }

    throw new AutoCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: lastError,
      details: lastError instanceof Error ? { message: lastError.message } : undefined,
    });
  }
}
