import { readMediaFile } from "../utils/media.js";
import { parseXTarget } from "../utils/targets.js";
import { AutoCliError } from "../errors.js";
import { maybeAutoRefreshSession } from "../utils/autorefresh.js";
import { serializeCookieJar } from "../utils/cookie-manager.js";
import { getPlatformOrigin } from "../platforms.js";
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

const X_ORIGIN = getPlatformOrigin("x");
const X_HOME = `${X_ORIGIN}/home`;
const X_VERIFY_CREDENTIALS_ENDPOINTS = [
  "https://api.x.com/1.1/account/verify_credentials.json?include_entities=false&skip_status=true&include_email=false",
  `${X_ORIGIN}/i/api/1.1/account/verify_credentials.json?include_entities=false&skip_status=true&include_email=false`,
] as const;
const X_MEDIA_UPLOAD_ENDPOINTS = [
  "https://upload.x.com/i/media/upload.json",
  "https://upload.twitter.com/i/media/upload.json",
] as const;
const X_CREATE_TWEET_OPERATION = "CreateTweet";
const X_FAVORITE_TWEET_OPERATION = "FavoriteTweet";

interface XProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

interface XVerifyCredentialsResponse {
  id_str?: string;
  name?: string;
  screen_name?: string;
}

interface XGraphQlError {
  code?: number;
  message?: string;
  name?: string;
}

interface XCreateTweetGraphQlResponse {
  data?: {
    create_tweet?: {
      tweet_results?: {
        result?: {
          rest_id?: string;
          legacy?: {
            id_str?: string;
          };
        };
      };
    };
  };
  errors?: XGraphQlError[];
}

interface XFavoriteTweetGraphQlResponse {
  data?: {
    favorite_tweet?: string;
  };
  errors?: XGraphQlError[];
}

interface XMediaUploadResponse {
  media_id_string?: string;
  processing_info?: {
    state?: string;
  };
}

export class XAdapter extends BasePlatformAdapter {
  readonly platform = "x" as const;

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
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "X session has expired.", {
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
          ? `Saved X session for ${account}.`
          : `Saved X session for ${account}, but validation was partial.`,
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
    return this.postText({
      account: input.account,
      text: input.caption ?? "",
      imagePath: input.mediaPath,
    });
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const mediaId = input.imagePath ? await this.uploadMedia(client, probe.metadata, bearerToken, input.imagePath) : undefined;
    const response = await this.createTweet(client, session, bearerToken, {
      tweet_text: input.text,
      dark_request: false,
      media: {
        media_entities: mediaId ? [{ media_id: mediaId, tagged_users: [] as string[] }] : [],
        possibly_sensitive: false,
      },
      semantic_annotation_ids: [] as string[],
      disallowed_reply_options: null,
    });

    const tweetId = this.extractTweetId(response);
    const username = probe.user?.username;
    const url = username && tweetId ? `${X_ORIGIN}/${username}/status/${tweetId}` : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "post",
      message: `X post created for ${session.account}.`,
      id: tweetId,
      url,
      user: probe.user,
      data: {
        text: input.text,
        imagePath: input.imagePath,
      },
    };
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const target = parseXTarget(input.target);

    await this.executeGraphQlMutation<XFavoriteTweetGraphQlResponse>(
      client,
      session,
      bearerToken,
      X_FAVORITE_TWEET_OPERATION,
      {
        tweet_id: target.tweetId,
      },
      {},
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `X post liked for ${session.account}.`,
      id: target.tweetId,
      user: probe.user,
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const target = parseXTarget(input.target);
    const response = await this.createTweet(client, session, bearerToken, {
      tweet_text: input.text,
      dark_request: false,
      media: {
        media_entities: [],
        possibly_sensitive: false,
      },
      semantic_annotation_ids: [] as string[],
      disallowed_reply_options: null,
      reply: {
        in_reply_to_tweet_id: target.tweetId,
        exclude_reply_user_ids: [] as string[],
      },
    });
    const tweetId = this.extractTweetId(response) ?? target.tweetId;

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `X reply sent for ${session.account}.`,
      id: tweetId,
      user: probe.user,
      data: {
        text: input.text,
      },
    };
  }

  private async ensureActiveSession(session: PlatformSession): Promise<XProbe> {
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "X session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    return probe;
  }

  private async prepareSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    return {
      path: loaded.path,
      session: await this.maybeAutoRefresh(loaded.session),
    };
  }

  private async maybeAutoRefresh(session: PlatformSession): Promise<PlatformSession> {
    const client = await this.createXClient(session);
    const refresh = await maybeAutoRefreshSession({
      platform: this.platform,
      session,
      jar: client.jar,
      strategy: "home_keepalive",
      capability: "auto",
      refresh: async () => {
        await client.request<string>(X_HOME, {
          responseType: "text",
          expectedStatus: 200,
          headers: {
            referer: X_HOME,
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

  private async probeSession(session: PlatformSession): Promise<XProbe> {
    const client = await this.createXClient(session);
    const authToken = await client.getCookieValue("auth_token", X_ORIGIN);
    const csrfToken = await client.getCookieValue("ct0", X_ORIGIN);

    if (!authToken || !csrfToken) {
      return {
        status: {
          state: "expired",
          message: "Missing X auth cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    const homeHtml = await client.request<string>(X_ORIGIN, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        "user-agent": "Mozilla/5.0 AutoCLI/0.1",
      },
    });

    if (homeHtml.includes("/i/flow/login") || homeHtml.includes("Log in to X")) {
      return {
        status: {
          state: "expired",
          message: "X returned a logged-out page. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "LOGGED_OUT",
        },
      };
    }

    const bearerToken = await this.resolveBearerToken(session, client, session.metadata).catch(() => undefined);
    const verifyCredentials = bearerToken
      ? await this.tryRequestChain<XVerifyCredentialsResponse | null>(
          X_VERIFY_CREDENTIALS_ENDPOINTS.map(
            (endpoint) => async () =>
              client.request(endpoint, {
                expectedStatus: 200,
                headers: await this.buildXHeaders(client, bearerToken, X_HOME),
              }),
          ),
          "",
          true,
        )
      : null;

    const hasLoggedInWebSession =
      !homeHtml.includes("/i/flow/login") &&
      !homeHtml.includes("Log in to X") &&
      homeHtml.includes("responsive-web/client-web/main.");

    const user = verifyCredentials?.screen_name
      ? {
          id: verifyCredentials.id_str,
          username: verifyCredentials.screen_name,
          displayName: verifyCredentials.name,
          profileUrl: `${X_ORIGIN}/${verifyCredentials.screen_name}`,
        }
      : undefined;

    return {
      status: {
        state: verifyCredentials || hasLoggedInWebSession ? "active" : "unknown",
        message: verifyCredentials
          ? "Session validated."
          : hasLoggedInWebSession
            ? "Web session looks active, but API verification could not complete."
            : "Cookies look present but X verification could not complete.",
        lastValidatedAt: new Date().toISOString(),
      },
      user,
      metadata: {
        bearerToken,
      },
    };
  }

  private async createXClient(session: PlatformSession) {
    return this.createClient(session, {
      accept: "application/json, text/plain, */*",
      origin: X_ORIGIN,
      "user-agent": "Mozilla/5.0 AutoCLI/0.1",
    });
  }

  private async resolveBearerToken(
    session: PlatformSession,
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const configured = process.env.AUTOCLI_X_BEARER_TOKEN;
    if (configured) {
      return configured;
    }

    const cached = typeof metadata?.bearerToken === "string" ? metadata.bearerToken : undefined;
    if (cached) {
      return cached;
    }

    const homeHtml = await client.request<string>(X_ORIGIN, {
      responseType: "text",
      expectedStatus: 200,
    });
    const mainScriptUrl = homeHtml.match(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[^"]+\.js/u)?.[0];

    if (!mainScriptUrl) {
      throw new AutoCliError("X_BEARER_TOKEN_NOT_FOUND", "Failed to locate the X main web bundle.");
    }

    const scriptBody = await fetch(mainScriptUrl).then((response) => response.text());
    const token = scriptBody.match(/AAAA[A-Za-z0-9%]{80,}/u)?.[0];

    if (!token) {
      throw new AutoCliError("X_BEARER_TOKEN_NOT_FOUND", "Failed to extract the X web bearer token.");
    }

    const decoded = decodeURIComponent(token);
    const jar = await this.cookieManager.createJar(session);
    await this.saveSession({
      account: session.account,
      source: session.source,
      user: session.user,
      status: session.status,
      metadata: {
        ...(session.metadata ?? {}),
        bearerToken: decoded,
      },
      jar,
      existingSession: session,
    });

    return decoded;
  }

  private async buildXHeaders(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    bearerToken: string,
    referer: string,
  ): Promise<Record<string, string>> {
    const csrfToken = await client.getCookieValue("ct0", X_ORIGIN);

    if (!csrfToken) {
      throw new AutoCliError("SESSION_EXPIRED", "X csrf token is missing. Re-import cookies.txt.");
    }

    return {
      authorization: `Bearer ${bearerToken}`,
      "content-type": "application/x-www-form-urlencoded",
      origin: X_ORIGIN,
      referer,
      "x-csrf-token": csrfToken,
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
    };
  }

  private async buildXJsonHeaders(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    bearerToken: string,
    referer: string,
  ): Promise<Record<string, string>> {
    return {
      ...(await this.buildXHeaders(client, bearerToken, referer)),
      accept: "*/*",
      "content-type": "application/json",
    };
  }

  private async uploadMedia(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    metadata: Record<string, unknown> | undefined,
    bearerToken: string,
    mediaPath: string,
  ): Promise<string> {
    const media = await readMediaFile(mediaPath);
    const initResponse = await this.tryRequestChain<XMediaUploadResponse>(
      X_MEDIA_UPLOAD_ENDPOINTS.map(
        (endpoint) => async () =>
          client.request(endpoint, {
            method: "POST",
            expectedStatus: 200,
            headers: await this.buildXHeaders(client, bearerToken, X_HOME),
            body: new URLSearchParams({
              command: "INIT",
              total_bytes: String(media.bytes.length),
              media_type: media.mimeType,
              media_category: "tweet_image",
            }),
          }),
      ),
      "Failed to initialize the X media upload.",
    );

    const mediaId = initResponse.media_id_string;
    if (!mediaId) {
      throw new AutoCliError("MEDIA_UPLOAD_FAILED", "X media upload did not return a media ID.");
    }

    const appendHeaders = await this.buildXUploadHeaders(client, bearerToken, X_HOME);

    const appendForm = new FormData();
    appendForm.set("command", "APPEND");
    appendForm.set("media_id", mediaId);
    appendForm.set("segment_index", "0");
    appendForm.set("media", new Blob([new Uint8Array(media.bytes)], { type: media.mimeType }), media.filename);

    await this.tryRequestChain(
      X_MEDIA_UPLOAD_ENDPOINTS.map(
        (endpoint) => async () =>
          client.request(endpoint, {
            method: "POST",
            expectedStatus: [200, 204],
            headers: appendHeaders,
            body: appendForm,
          }),
      ),
      "Failed to append media bytes to the X upload.",
    );

    const finalizeResponse = await this.tryRequestChain<XMediaUploadResponse>(
      X_MEDIA_UPLOAD_ENDPOINTS.map(
        (endpoint) => async () =>
          client.request(endpoint, {
            method: "POST",
            expectedStatus: 200,
            headers: await this.buildXHeaders(client, bearerToken, X_HOME),
            body: new URLSearchParams({
              command: "FINALIZE",
              media_id: mediaId,
            }),
          }),
      ),
      "Failed to finalize the X media upload.",
    );

    if (finalizeResponse.processing_info?.state && finalizeResponse.processing_info.state !== "succeeded") {
      throw new AutoCliError("MEDIA_UPLOAD_PROCESSING", "X media upload is still processing. Retry in a few seconds.", {
        details: {
          state: finalizeResponse.processing_info.state,
          mediaId,
          metadata,
        },
      });
    }

    return mediaId;
  }

  private async persistSessionState(session: PlatformSession, probe: XProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async buildXUploadHeaders(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    bearerToken: string,
    referer: string,
  ): Promise<Record<string, string>> {
    const headers = await this.buildXHeaders(client, bearerToken, referer);
    const { "content-type": _contentType, ...rest } = headers;
    return rest;
  }

  private async createTweet(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    session: PlatformSession,
    bearerToken: string,
    variables: Record<string, unknown>,
  ): Promise<XCreateTweetGraphQlResponse> {
    return this.executeGraphQlMutation<XCreateTweetGraphQlResponse>(
      client,
      session,
      bearerToken,
      X_CREATE_TWEET_OPERATION,
      variables,
      {},
    );
  }

  private async executeGraphQlMutation<T extends { errors?: XGraphQlError[] }>(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    session: PlatformSession,
    bearerToken: string,
    operationName: string,
    variables: Record<string, unknown>,
    features: Record<string, unknown>,
  ): Promise<T> {
    const queryId = await this.resolveGraphQlOperationQueryId(session, client, operationName);
    const response = await client.request<T>(`${X_ORIGIN}/i/api/graphql/${queryId}/${operationName}`, {
      method: "POST",
      expectedStatus: 200,
      headers: await this.buildXJsonHeaders(client, bearerToken, `${X_ORIGIN}/compose/post`),
      body: JSON.stringify({
        variables,
        features,
        queryId,
      }),
    });

    this.throwOnGraphQlErrors(response, operationName);
    return response;
  }

  private async resolveGraphQlOperationQueryId(
    session: PlatformSession,
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    operationName: string,
  ): Promise<string> {
    const cachedOperations =
      session.metadata && typeof session.metadata.graphqlOperations === "object" && session.metadata.graphqlOperations
        ? (session.metadata.graphqlOperations as Record<string, { queryId?: string }>)
        : {};

    const cached = cachedOperations[operationName]?.queryId;
    if (cached) {
      return cached;
    }

    const homeHtml = await client.request<string>(X_ORIGIN, {
      responseType: "text",
      expectedStatus: 200,
    });
    const mainScriptUrl = homeHtml.match(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[^"]+\.js/u)?.[0];
    if (!mainScriptUrl) {
      throw new AutoCliError("X_WEB_BUNDLE_NOT_FOUND", "Failed to locate the X web app bundle.");
    }

    const scriptBody = await fetch(mainScriptUrl).then((response) => response.text());
    const pattern = new RegExp(`queryId:"([^"]+)",operationName:"${operationName}"`, "u");
    const queryId = scriptBody.match(pattern)?.[1];
    if (!queryId) {
      throw new AutoCliError("X_GRAPHQL_OPERATION_NOT_FOUND", `Failed to locate the X ${operationName} operation ID.`);
    }

    const jar = await this.cookieManager.createJar(session);
    await this.saveSession({
      account: session.account,
      source: session.source,
      user: session.user,
      status: session.status,
      metadata: {
        ...(session.metadata ?? {}),
        graphqlOperations: {
          ...cachedOperations,
          [operationName]: {
            queryId,
          },
        },
      },
      jar,
      existingSession: session,
    });

    return queryId;
  }

  private throwOnGraphQlErrors(response: XCreateTweetGraphQlResponse, operationName: string): void {
    const firstError = response.errors?.[0];
    if (!firstError) {
      return;
    }

    if (firstError.code === 144) {
      throw new AutoCliError("X_TWEET_NOT_FOUND", "X could not find the target tweet (code 144).", {
        details: {
          operation: operationName,
          code: firstError.code,
          upstreamMessage: firstError.message,
        },
      });
    }

    if (firstError.code === 344) {
      throw new AutoCliError(
        "X_DAILY_LIMIT_REACHED",
        "X says this account has reached its daily posting/message limit (code 344).",
        {
          details: {
            operation: operationName,
            code: firstError.code,
            upstreamMessage: firstError.message,
          },
        },
      );
    }

    if (firstError.code === 226) {
      throw new AutoCliError(
        "X_AUTOMATION_BLOCKED",
        "X blocked this write as suspected automation (code 226). The session is valid, but the platform rejected the action.",
        {
          details: {
            operation: operationName,
            code: firstError.code,
            upstreamMessage: firstError.message,
          },
        },
      );
    }

    throw new AutoCliError(`X_${operationName.toUpperCase()}_FAILED`, firstError.message ?? `X ${operationName} failed.`, {
      details: {
        operation: operationName,
        code: firstError.code,
        name: firstError.name,
      },
    });
  }

  private extractTweetId(response: XCreateTweetGraphQlResponse): string | undefined {
    return response.data?.create_tweet?.tweet_results?.result?.rest_id ?? response.data?.create_tweet?.tweet_results?.result?.legacy?.id_str;
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
