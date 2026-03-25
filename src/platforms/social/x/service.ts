import { readMediaFile } from "../../../utils/media.js";
import { parseXProfileTarget, parseXTarget } from "../../../utils/targets.js";
import { AutoCliError } from "../../../errors.js";
import { maybeAutoRefreshSession } from "../../../utils/autorefresh.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import { getPlatformOrigin } from "../../config.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";

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
const X_UNFAVORITE_TWEET_OPERATION = "UnfavoriteTweet";
const X_TWEET_RESULT_OPERATION = "TweetResultByRestId";
const X_USER_BY_SCREEN_NAME_OPERATION = "UserByScreenName";
const X_USER_BY_REST_ID_OPERATION = "UserByRestId";
const X_USER_TWEETS_OPERATION = "UserTweets";

const X_DEFAULT_QUERY_FEATURES = {
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_media_download_video_enabled: false,
  responsive_web_enhance_cards_enabled: false,
} as const;

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

interface XBasicMutationResponse {
  errors?: XGraphQlError[];
}

interface XTweetSummary {
  id: string;
  text?: string;
  url?: string;
  authorUsername?: string;
  authorName?: string;
  authorUrl?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  quoteCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  createdAt?: string;
}

interface XUserSummary {
  id: string;
  username: string;
  displayName?: string;
  description?: string;
  url?: string;
  followersCount?: number;
  followingCount?: number;
  tweetCount?: number;
  verified?: boolean;
  profileImageUrl?: string;
}

interface XMediaUploadResponse {
  media_id_string?: string;
  processing_info?: {
    state?: string;
  };
}

interface XUserTypeaheadResponse {
  num_results?: number;
  users?: Array<{
    id?: number | string;
    id_str?: string;
    name?: string;
    screen_name?: string;
    description?: string;
    verified?: boolean;
    profile_image_url_https?: string;
    followers_count?: number;
    friends_count?: number;
    statuses_count?: number;
  }>;
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

  async unlike(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const target = parseXTarget(input.target);

    await this.executeGraphQlMutation<XBasicMutationResponse>(
      client,
      session,
      bearerToken,
      X_UNFAVORITE_TWEET_OPERATION,
      {
        tweet_id: target.tweetId,
      },
      {},
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unlike",
      message: `X post unliked for ${session.account}.`,
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

  async search(input: {
    account?: string;
    query: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const query = input.query.trim();

    if (!query) {
      throw new AutoCliError("INVALID_SEARCH_QUERY", "Expected a non-empty X search query.");
    }

    const limit = this.normalizeSearchLimit(input.limit);
    const results = await this.searchXUsers(client, bearerToken, query, limit);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "search",
      message:
        results.length > 0
          ? `Found ${results.length} X account result${results.length === 1 ? "" : "s"} for "${query}".`
          : `No X account results found for "${query}".`,
      user: probe.user,
      data: {
        query,
        limit,
        results: results.map((result) => ({ ...result })),
      },
    };
  }

  async tweetInfo(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const target = parseXTarget(input.target);

    const response = await this.executeGraphQlQuery<Record<string, unknown>>(
      client,
      session,
      bearerToken,
      X_TWEET_RESULT_OPERATION,
      {
        tweetId: target.tweetId,
        withCommunity: false,
        includePromotedContent: false,
        withVoice: false,
      },
      X_DEFAULT_QUERY_FEATURES,
      target.url ?? `${X_ORIGIN}/i/status/${target.tweetId}`,
    );

    const tweet = this.extractTweetSummaries(response, 1)[0];
    if (!tweet) {
      throw new AutoCliError("X_TWEET_NOT_FOUND", "X could not load that post.", {
        details: {
          target: input.target,
          tweetId: target.tweetId,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "tweetid",
      message: `Loaded X post details for ${tweet.id}.`,
      id: tweet.id,
      url: tweet.url,
      user: probe.user,
      data: { ...tweet },
    };
  }

  async profileInfo(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const profile = await this.resolveXProfile(client, session, bearerToken, input.target);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "profileid",
      message: `Loaded X profile details for ${profile.username}.`,
      id: profile.id,
      url: profile.url,
      user: probe.user,
      data: { ...profile },
    };
  }

  async tweets(input: {
    account?: string;
    target: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createXClient(session);
    const bearerToken = await this.resolveBearerToken(session, client, probe.metadata);
    const profile = await this.resolveXProfile(client, session, bearerToken, input.target);
    const limit = this.normalizeSearchLimit(input.limit);

    const response = await this.executeGraphQlQuery<Record<string, unknown>>(
      client,
      session,
      bearerToken,
      X_USER_TWEETS_OPERATION,
      {
        userId: profile.id,
        count: limit,
        includePromotedContent: false,
        withVoice: false,
      },
      X_DEFAULT_QUERY_FEATURES,
      profile.url ?? `${X_ORIGIN}/${profile.username}`,
    );

    const tweets = this.extractTweetSummaries(response, limit);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "tweets",
      message:
        tweets.length > 0
          ? `Loaded ${tweets.length} X post${tweets.length === 1 ? "" : "s"} for ${profile.username}.`
          : `No X posts found for ${profile.username}.`,
      id: profile.id,
      url: profile.url,
      user: probe.user,
      data: {
        profile: { ...profile },
        limit,
        tweets: tweets.map((tweet) => ({ ...tweet })),
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

  private async executeGraphQlQuery<T extends { errors?: XGraphQlError[] }>(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    session: PlatformSession,
    bearerToken: string,
    operationName: string,
    variables: Record<string, unknown>,
    features: Record<string, unknown>,
    referer: string,
  ): Promise<T> {
    const queryId = await this.resolveGraphQlOperationQueryId(session, client, operationName);
    const url = new URL(`${X_ORIGIN}/i/api/graphql/${queryId}/${operationName}`);
    url.searchParams.set("variables", JSON.stringify(variables));
    url.searchParams.set("features", JSON.stringify(features));

    const response = await client.request<T>(url.toString(), {
      expectedStatus: 200,
      headers: {
        ...(await this.buildXHeaders(client, bearerToken, referer)),
        accept: "*/*",
      },
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

    if (firstError.code === 34) {
      throw new AutoCliError("X_RESOURCE_NOT_FOUND", `X could not find the requested resource for ${operationName} (code 34).`, {
        details: {
          operation: operationName,
          code: firstError.code,
          upstreamMessage: firstError.message,
        },
      });
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

  private normalizeSearchLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 5;
    }

    return Math.max(1, Math.min(25, Math.floor(limit)));
  }

  private async resolveXProfile(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    session: PlatformSession,
    bearerToken: string,
    target: string,
  ): Promise<XUserSummary> {
    const parsed = parseXProfileTarget(target);
    if (parsed.username) {
      const results = await this.searchXUsers(client, bearerToken, parsed.username, 10);
      const exactMatch =
        results.find((user) => user.username.toLowerCase() === parsed.username?.toLowerCase()) ?? results[0];
      if (exactMatch) {
        return exactMatch;
      }
    }

    const operationName = parsed.userId ? X_USER_BY_REST_ID_OPERATION : X_USER_BY_SCREEN_NAME_OPERATION;
    const variables = parsed.userId
      ? {
          userId: parsed.userId,
          withSafetyModeUserFields: true,
        }
      : {
          screen_name: parsed.username,
          withSafetyModeUserFields: true,
        };
    const response = await this.executeGraphQlQuery<Record<string, unknown>>(
      client,
      session,
      bearerToken,
      operationName,
      variables,
      X_DEFAULT_QUERY_FEATURES,
      parsed.url ?? (parsed.username ? `${X_ORIGIN}/${parsed.username}` : X_HOME),
    );

    const user = this.extractUserSummaries(response, 1)[0];
    if (!user) {
      throw new AutoCliError("X_PROFILE_NOT_FOUND", "X could not load that profile.", {
        details: {
          target,
          userId: parsed.userId,
          username: parsed.username,
        },
      });
    }

    return user;
  }

  private async searchXUsers(
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    bearerToken: string,
    query: string,
    limit: number,
  ): Promise<XUserSummary[]> {
    const response = await client.request<XUserTypeaheadResponse>(
      `${X_ORIGIN}/i/api/1.1/search/typeahead.json?src=search_box&q=${encodeURIComponent(query)}&result_type=users`,
      {
        expectedStatus: 200,
        headers: await this.buildXHeaders(client, bearerToken, X_HOME),
      },
    );

    return (response.users ?? [])
      .filter((user): user is NonNullable<XUserTypeaheadResponse["users"]>[number] => Boolean(user?.screen_name))
      .slice(0, limit)
      .map((user) => ({
        id: String(user.id_str ?? user.id ?? ""),
        username: user.screen_name ?? "",
        displayName: user.name ?? undefined,
        description: user.description ?? undefined,
        url: user.screen_name ? `${X_ORIGIN}/${user.screen_name}` : undefined,
        followersCount: user.followers_count,
        followingCount: user.friends_count,
        tweetCount: user.statuses_count,
        verified: user.verified,
        profileImageUrl: user.profile_image_url_https ?? undefined,
      }));
  }

  private extractTweetSummaries(response: Record<string, unknown>, limit: number): XTweetSummary[] {
    const results: XTweetSummary[] = [];
    const seen = new Set<string>();

    this.walkForTweetSummaries(response, results, seen, limit);
    return results.slice(0, limit);
  }

  private walkForTweetSummaries(
    node: unknown,
    results: XTweetSummary[],
    seen: Set<string>,
    limit: number,
  ): void {
    if (results.length >= limit || !node) {
      return;
    }

    if (Array.isArray(node)) {
      for (const entry of node) {
        this.walkForTweetSummaries(entry, results, seen, limit);
        if (results.length >= limit) {
          return;
        }
      }
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const tweet = this.parseTweetSummary(node);
    if (tweet && !seen.has(tweet.id)) {
      seen.add(tweet.id);
      results.push(tweet);
      if (results.length >= limit) {
        return;
      }
    }

    for (const value of Object.values(node as Record<string, unknown>)) {
      this.walkForTweetSummaries(value, results, seen, limit);
      if (results.length >= limit) {
        return;
      }
    }
  }

  private parseTweetSummary(node: unknown): XTweetSummary | undefined {
    if (!node || typeof node !== "object") {
      return undefined;
    }

    const record = node as Record<string, unknown>;
    const legacy = this.asRecord(record.legacy);
    if (!legacy) {
      return undefined;
    }

    const id = typeof record.rest_id === "string" ? record.rest_id : typeof legacy.id_str === "string" ? legacy.id_str : undefined;
    const text = typeof legacy.full_text === "string" ? legacy.full_text : undefined;
    if (!id || !text) {
      return undefined;
    }

    const core = this.asRecord(record.core);
    const userResults = core ? this.asRecord(core.user_results) : undefined;
    const userResult = userResults ? this.asRecord(userResults.result) : undefined;
    const userLegacy = userResult ? this.asRecord(userResult.legacy) : undefined;
    const userCore = userResult ? this.asRecord(userResult.core) : undefined;
    const authorUsername =
      userCore && typeof userCore.screen_name === "string"
        ? userCore.screen_name
        : userLegacy && typeof userLegacy.screen_name === "string"
          ? userLegacy.screen_name
          : undefined;
    const authorName =
      userCore && typeof userCore.name === "string"
        ? userCore.name
        : userLegacy && typeof userLegacy.name === "string"
          ? userLegacy.name
          : undefined;

    return {
      id,
      text,
      url: authorUsername ? `${X_ORIGIN}/${authorUsername}/status/${id}` : `${X_ORIGIN}/i/status/${id}`,
      authorUsername,
      authorName,
      authorUrl: authorUsername ? `${X_ORIGIN}/${authorUsername}` : undefined,
      likeCount: typeof legacy.favorite_count === "number" ? legacy.favorite_count : undefined,
      retweetCount: typeof legacy.retweet_count === "number" ? legacy.retweet_count : undefined,
      replyCount: typeof legacy.reply_count === "number" ? legacy.reply_count : undefined,
      quoteCount: typeof legacy.quote_count === "number" ? legacy.quote_count : undefined,
      bookmarkCount: typeof legacy.bookmark_count === "number" ? legacy.bookmark_count : undefined,
      viewCount: this.readNumericString(this.asRecord(record.views)?.count),
      createdAt: typeof legacy.created_at === "string" ? new Date(legacy.created_at).toISOString() : undefined,
    };
  }

  private extractUserSummaries(response: Record<string, unknown>, limit: number): XUserSummary[] {
    const results: XUserSummary[] = [];
    const seen = new Set<string>();
    this.walkForUserSummaries(response, results, seen, limit);
    return results.slice(0, limit);
  }

  private walkForUserSummaries(
    node: unknown,
    results: XUserSummary[],
    seen: Set<string>,
    limit: number,
  ): void {
    if (results.length >= limit || !node) {
      return;
    }

    if (Array.isArray(node)) {
      for (const entry of node) {
        this.walkForUserSummaries(entry, results, seen, limit);
        if (results.length >= limit) {
          return;
        }
      }
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const user = this.parseUserSummary(node);
    if (user && !seen.has(user.id)) {
      seen.add(user.id);
      results.push(user);
      if (results.length >= limit) {
        return;
      }
    }

    for (const value of Object.values(node as Record<string, unknown>)) {
      this.walkForUserSummaries(value, results, seen, limit);
      if (results.length >= limit) {
        return;
      }
    }
  }

  private parseUserSummary(node: unknown): XUserSummary | undefined {
    if (!node || typeof node !== "object") {
      return undefined;
    }

    const record = node as Record<string, unknown>;
    const legacy = this.asRecord(record.legacy);
    const core = this.asRecord(record.core);
    const restId =
      typeof record.rest_id === "string"
        ? record.rest_id
        : typeof record.id === "string"
          ? this.decodeXEntityRestId(record.id, "User")
          : undefined;
    const username =
      core && typeof core.screen_name === "string"
        ? core.screen_name
        : legacy && typeof legacy.screen_name === "string"
          ? legacy.screen_name
          : undefined;
    if (!restId || !username) {
      return undefined;
    }

    const avatar = this.asRecord(record.avatar);
    return {
      id: restId,
      username,
      displayName:
        core && typeof core.name === "string"
          ? core.name
          : typeof legacy?.name === "string"
            ? legacy.name
            : undefined,
      description: typeof legacy?.description === "string" ? legacy.description : undefined,
      url: `${X_ORIGIN}/${username}`,
      followersCount: typeof legacy?.followers_count === "number" ? legacy.followers_count : undefined,
      followingCount: typeof legacy?.friends_count === "number" ? legacy.friends_count : undefined,
      tweetCount: typeof legacy?.statuses_count === "number" ? legacy.statuses_count : undefined,
      verified: record.is_blue_verified === true || legacy?.verified === true,
      profileImageUrl:
        avatar && typeof avatar.image_url === "string"
          ? avatar.image_url
          : typeof legacy?.profile_image_url_https === "string"
            ? legacy.profile_image_url_https
            : undefined,
    };
  }

  private decodeXEntityRestId(encodedId: string, expectedType: string): string | undefined {
    try {
      const decoded = Buffer.from(encodedId, "base64").toString("utf8");
      const match = decoded.match(new RegExp(`^${expectedType}:(\\d+)$`, "u"));
      return match?.[1];
    } catch {
      return undefined;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
  }

  private readNumericString(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
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
