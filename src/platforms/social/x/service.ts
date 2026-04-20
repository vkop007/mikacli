import { readMediaFile } from "../../../utils/media.js";
import { appendUploadFileField } from "../../../utils/upload-pipeline.js";
import { parseXProfileTarget, parseXTarget } from "../../../utils/targets.js";
import { MikaCliError } from "../../../errors.js";
import { maybeAutoRefreshSession } from "../../../utils/autorefresh.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import {
  runFirstClassBrowserAction,
  withBrowserActionMetadata,
} from "../../../core/runtime/browser-action-runtime.js";
import { getPlatformOrigin } from "../../config.js";
import { normalizeWhitespace } from "../../data/shared/text.js";
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
import type { Locator as PlaywrightLocator, Page as PlaywrightPage, Response as PlaywrightResponse } from "playwright-core";

const X_ORIGIN = getPlatformOrigin("x");
const X_HOME = `${X_ORIGIN}/home`;
const X_COMPOSE_URL = `${X_ORIGIN}/compose/post`;
const X_BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const X_VERIFY_CREDENTIALS_ENDPOINTS = [
  "https://api.x.com/1.1/account/verify_credentials.json?include_entities=false&skip_status=true&include_email=false",
  `${X_ORIGIN}/i/api/1.1/account/verify_credentials.json?include_entities=false&skip_status=true&include_email=false`,
] as const;
const X_MEDIA_UPLOAD_ENDPOINTS = [
  "https://upload.x.com/i/media/upload.json",
  "https://upload.twitter.com/i/media/upload.json",
] as const;
const X_CREATE_TWEET_OPERATION = "CreateTweet";
const X_DELETE_TWEET_OPERATION = "DeleteTweet";
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
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "X session has expired.", {
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

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: `X session is ${status.status}.`,
      user: status.user,
      sessionPath: status.sessionPath,
      data: {
        connected: status.connected,
        status: status.status,
        details: status.message,
        lastValidatedAt: status.lastValidatedAt,
      },
    };
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    return this.postText({
      account: input.account,
      text: input.caption ?? "",
      imagePath: input.mediaPath,
    });
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    return this.browserPostText(input);
  }

  private async browserPostText(input: TextPostInput): Promise<AdapterActionResult> {
    const { session, path, probe } = await this.prepareBrowserWriteSession(input.account);
    const username = probe.user?.username ?? session.user?.username;
    const timeoutSeconds = input.browserTimeoutSeconds ?? 60;

    const execution = await runFirstClassBrowserAction<{
      tweetId?: string;
      finalUrl?: string;
      source: "headless" | "profile" | "shared";
    }>({
      platform: this.platform,
      action: "post",
      actionLabel: "post",
      targetUrl: X_COMPOSE_URL,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: X_BROWSER_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: this.buildBrowserWriteSteps("posting", X_COMPOSE_URL, Boolean(input.browser)),
      actionFn: async (page, source) => {
        await this.ensureBrowserAuthenticated(page);
        await this.openComposer(page);
        await this.fillBrowserComposerText(page, input.text);
        if (input.imagePath) {
          await this.attachBrowserComposerImage(page, input.imagePath);
        }

        const responsePromise = page.waitForResponse(
          (response) => response.request().method() === "POST" && response.url().includes("/CreateTweet"),
          { timeout: Math.min(timeoutSeconds * 1_000, 30_000) },
        ).catch(() => undefined);
        const submitButton = await this.waitForEnabledBrowserPostButton(page);
        await submitButton.click();
        const response = await responsePromise;

        if (!response) {
          await page.waitForTimeout(1_500);
          await this.throwIfBrowserBlocked(page);
          throw new MikaCliError(
            "X_BROWSER_CREATE_TWEET_TIMEOUT",
            "X never sent the compose request from the browser-backed post flow. Retry once, or re-login with `mikacli social x login --browser` if the problem persists.",
            {
              details: {
                url: page.url(),
              },
            },
          );
        }

        const payload = (await response.json().catch(() => null)) as XCreateTweetGraphQlResponse | null;

        if (!payload) {
          throw new MikaCliError("X_BROWSER_ACTION_FAILED", "X submitted the browser post, but MikaCLI could not read the resulting response.");
        }

        this.throwOnGraphQlErrors(payload, X_CREATE_TWEET_OPERATION);
        const tweetId = this.extractTweetId(payload);
        await page.waitForTimeout(1_500);
        await this.throwIfBrowserBlocked(page);
        const browserUsername = await this.resolveBrowserUsername(page).catch(() => undefined);

        return {
          tweetId,
          finalUrl: this.buildBrowserTweetUrl(username ?? browserUsername, tweetId, page.url()),
          source,
        };
      },
    });
    const result = execution.value;

    await this.persistBrowserWriteSuccess(session, probe, "X browser-backed compose flow succeeded.");

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "post",
      message: `X post created for ${session.account} through a browser-backed compose flow.`,
      id: result.tweetId,
      url: result.finalUrl,
      user: probe.user,
      sessionPath: path,
      data: {
        text: input.text,
        imagePath: input.imagePath,
      },
    }, execution);
  }

  private async waitForEnabledBrowserPostButton(page: PlaywrightPage) {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      for (const selector of [
          '[data-testid="tweetButtonInline"]',
          '[data-testid="tweetButton"]',
          'button[aria-label="Post"]',
          'button:has-text("Post")',
        ] as const) {
        const locator = page.locator(selector);
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const candidate = locator.nth(index);
          const visible = await candidate.isVisible().catch(() => false);
          const enabled = await candidate.isEnabled().catch(() => false);
          if (visible && enabled) {
            return candidate;
          }
        }
      }
      await page.waitForTimeout(250);
    }

    throw new MikaCliError("X_BROWSER_POST_BUTTON_DISABLED", "X never enabled the browser post button for the composed text.", {
      details: {
        url: page.url(),
      },
    });
  }

  async like(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    return this.browserLike(input);
  }

  async unlike(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    return this.browserUnlike(input);
  }

  async comment(input: CommentInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    return this.browserComment(input);
  }

  async deleteTweet(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    return this.browserDeleteTweet(input);
  }

  private async browserLike(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path, probe } = await this.prepareBrowserWriteSession(input.account);
    const target = parseXTarget(input.target);
    const targetUrl = target.url ?? `${X_ORIGIN}/i/status/${target.tweetId}`;
    const timeoutSeconds = input.browserTimeoutSeconds ?? 60;
    const steps = input.browser
      ? [{
          source: "shared" as const,
          announceLabel: `Opening shared MikaCLI browser profile for X deleting: ${targetUrl}`,
        }]
      : [{ source: "headless" as const }];

    const execution = await runFirstClassBrowserAction<{
      finalUrl?: string;
      source: "headless" | "profile" | "shared";
      alreadyLiked?: boolean;
    }>({
      platform: this.platform,
      action: "like",
      actionLabel: "like",
      targetUrl,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: X_BROWSER_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: this.buildBrowserWriteSteps("liking", targetUrl, Boolean(input.browser)),
      actionFn: async (page, source) => {
        await this.ensureBrowserAuthenticated(page);
        const article = await this.waitForBrowserTweetArticle(page, target.tweetId);
        const initialState = await this.readBrowserLikeState(article);
        if (initialState === "liked") {
          return {
            finalUrl: page.url(),
            source,
            alreadyLiked: true,
          };
        }

        const responsePromise = this.waitForBrowserMutationResponse(page, X_FAVORITE_TWEET_OPERATION, timeoutSeconds);
        const button = await firstVisibleXLocatorWithin(article, ['[data-testid="like"]']);
        await button.click();
        const liked = await this.waitForBrowserLikeState(page, article, "liked");
        const response = await this.readBrowserMutationPayloadIfReady(page, responsePromise);
        await this.throwIfBrowserBlocked(page);
        if (!liked) {
          throw new MikaCliError("X_BROWSER_ACTION_FAILED", "X did not confirm the like action in the browser flow.", {
            details: {
              tweetId: target.tweetId,
              url: page.url(),
            },
          });
        }

        if (response) {
          const payload = await this.readBrowserMutationPayload<XFavoriteTweetGraphQlResponse>(
            response,
            "X liked the post in the browser flow, but MikaCLI could not read the resulting response.",
          );
          this.throwOnGraphQlErrors(payload, X_FAVORITE_TWEET_OPERATION);
        }

        return {
          finalUrl: page.url(),
          source,
        };
      },
    });
    const result = execution.value;

    await this.persistBrowserWriteSuccess(session, probe, "X browser-backed like flow succeeded.");

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: result.alreadyLiked
        ? `X post was already liked for ${session.account} in the browser-backed flow.`
        : `X post liked for ${session.account} through a browser-backed flow.`,
      id: target.tweetId,
      url: result.finalUrl ?? target.url,
      user: probe.user,
      sessionPath: path,
      data: {
        target: target.tweetId,
        alreadyLiked: Boolean(result.alreadyLiked),
      },
    }, execution);
  }

  private async browserUnlike(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path, probe } = await this.prepareBrowserWriteSession(input.account);
    const target = parseXTarget(input.target);
    const targetUrl = target.url ?? `${X_ORIGIN}/i/status/${target.tweetId}`;
    const timeoutSeconds = input.browserTimeoutSeconds ?? 60;

    const execution = await runFirstClassBrowserAction<{
      finalUrl?: string;
      source: "headless" | "profile" | "shared";
      alreadyUnliked?: boolean;
    }>({
      platform: this.platform,
      action: "unlike",
      actionLabel: "unlike",
      targetUrl,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: X_BROWSER_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: this.buildBrowserWriteSteps("unliking", targetUrl, Boolean(input.browser)),
      actionFn: async (page, source) => {
        await this.ensureBrowserAuthenticated(page);
        const article = await this.waitForBrowserTweetArticle(page, target.tweetId);
        const initialState = await this.readBrowserLikeState(article);
        if (initialState === "unliked") {
          return {
            finalUrl: page.url(),
            source,
            alreadyUnliked: true,
          };
        }

        const responsePromise = this.waitForBrowserMutationResponse(page, X_UNFAVORITE_TWEET_OPERATION, timeoutSeconds);
        const button = await firstVisibleXLocatorWithin(article, ['[data-testid="unlike"]']);
        await button.click();
        await this.confirmBrowserUnlikeIfNeeded(page);
        const unliked = await this.waitForBrowserLikeState(page, article, "unliked");
        const response = await this.readBrowserMutationPayloadIfReady(page, responsePromise);
        await this.throwIfBrowserBlocked(page);
        if (!unliked) {
          throw new MikaCliError("X_BROWSER_ACTION_FAILED", "X did not confirm the unlike action in the browser flow.", {
            details: {
              tweetId: target.tweetId,
              url: page.url(),
            },
          });
        }

        if (response) {
          const payload = await this.readBrowserMutationPayload<XBasicMutationResponse>(
            response,
            "X unliked the post in the browser flow, but MikaCLI could not read the resulting response.",
          );
          this.throwOnGraphQlErrors(payload, X_UNFAVORITE_TWEET_OPERATION);
        }

        return {
          finalUrl: page.url(),
          source,
        };
      },
    });
    const result = execution.value;

    await this.persistBrowserWriteSuccess(session, probe, "X browser-backed unlike flow succeeded.");

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unlike",
      message: result.alreadyUnliked
        ? `X post was already unliked for ${session.account} in the browser-backed flow.`
        : `X post unliked for ${session.account} through a browser-backed flow.`,
      id: target.tweetId,
      url: result.finalUrl ?? target.url,
      user: probe.user,
      sessionPath: path,
      data: {
        target: target.tweetId,
        alreadyUnliked: Boolean(result.alreadyUnliked),
      },
    }, execution);
  }

  private async browserComment(input: CommentInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path, probe } = await this.prepareBrowserWriteSession(input.account);
    const target = parseXTarget(input.target);
    const username = probe.user?.username ?? session.user?.username;
    const targetUrl = target.url ?? `${X_ORIGIN}/i/status/${target.tweetId}`;
    const timeoutSeconds = input.browserTimeoutSeconds ?? 60;

    const execution = await runFirstClassBrowserAction<{
      tweetId?: string;
      finalUrl?: string;
      source: "headless" | "profile" | "shared";
    }>({
      platform: this.platform,
      action: "comment",
      actionLabel: "reply",
      targetUrl,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: X_BROWSER_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: this.buildBrowserWriteSteps("replying", targetUrl, Boolean(input.browser)),
      actionFn: async (page, source) => {
        await this.ensureBrowserAuthenticated(page);
        const article = await this.waitForBrowserTweetArticle(page, target.tweetId);
        const replyButton = await firstVisibleXLocatorWithin(article, ['[data-testid="reply"]']);
        await replyButton.click();
        await page.waitForTimeout(700);
        await this.fillBrowserComposerText(page, input.text);

        const responsePromise = this.waitForBrowserMutationResponse(page, X_CREATE_TWEET_OPERATION, timeoutSeconds);
        const submitButton = await this.waitForEnabledBrowserPostButton(page);
        await submitButton.click();
        const response = await responsePromise;

        if (!response) {
          await page.waitForTimeout(1_500);
          await this.throwIfBrowserBlocked(page);
          throw new MikaCliError(
            "X_BROWSER_CREATE_TWEET_TIMEOUT",
            "X never sent the reply request from the browser-backed flow. Retry once, or re-login with `mikacli social x login --browser` if the problem persists.",
            {
              details: {
                url: page.url(),
                tweetId: target.tweetId,
              },
            },
          );
        }

        const payload = await this.readBrowserMutationPayload<XCreateTweetGraphQlResponse>(
          response,
          "X submitted the browser reply, but MikaCLI could not read the resulting response.",
        );
        this.throwOnGraphQlErrors(payload, X_CREATE_TWEET_OPERATION);
        const tweetId = this.extractTweetId(payload);
        await page.waitForTimeout(1_500);
        await this.throwIfBrowserBlocked(page);
        const browserUsername = await this.resolveBrowserUsername(page).catch(() => undefined);

        return {
          tweetId,
          finalUrl: this.buildBrowserTweetUrl(username ?? browserUsername, tweetId, page.url()),
          source,
        };
      },
    });
    const result = execution.value;

    await this.persistBrowserWriteSuccess(session, probe, "X browser-backed reply flow succeeded.");

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `X reply sent for ${session.account} through a browser-backed flow.`,
      id: result.tweetId ?? target.tweetId,
      url: result.finalUrl ?? target.url,
      user: probe.user,
      sessionPath: path,
      data: {
        text: input.text,
        target: target.tweetId,
      },
    }, execution);
  }

  private async browserDeleteTweet(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path, probe } = await this.prepareBrowserWriteSession(input.account);
    const target = parseXTarget(input.target);
    const targetUrl = target.url ?? `${X_ORIGIN}/i/status/${target.tweetId}`;
    const timeoutSeconds = input.browserTimeoutSeconds ?? 60;
    const steps = input.browser
      ? [{
          source: "shared" as const,
          announceLabel: `Opening shared MikaCLI browser profile for X deleting: ${targetUrl}`,
        }]
      : [{ source: "headless" as const }];

    const execution = await runFirstClassBrowserAction<{
      finalUrl?: string;
      source: "headless" | "profile" | "shared";
    }>({
      platform: this.platform,
      action: "delete",
      actionLabel: "delete",
      targetUrl,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: X_BROWSER_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps,
      actionFn: async (page, source) => {
        await this.ensureBrowserAuthenticated(page);
        const article = await this.waitForBrowserTweetArticle(page, target.tweetId);

        const responsePromise = this.waitForBrowserMutationResponse(page, X_DELETE_TWEET_OPERATION, timeoutSeconds);
        const menuButton = await firstVisibleXLocatorWithin(article, [
          '[data-testid="caret"]',
          'button[aria-label*="More" i]',
          'button[aria-label*="more" i]',
        ]);
        await menuButton.click();
        await page.waitForTimeout(400);

        const deleteOption = await firstVisibleXMenuItem(page, /delete/i);
        await deleteOption.click();
        await page.waitForTimeout(400);

        const confirmButton = await firstVisibleXDialogButton(page, /delete/i);
        await confirmButton.click();

        const response = await this.readBrowserMutationPayloadIfReady(page, responsePromise, Math.min(timeoutSeconds * 1_000, 10_000));
        if (response) {
          const payload = await this.readBrowserMutationPayload<XBasicMutationResponse>(
            response,
            "X deleted the post in the browser flow, but MikaCLI could not read the resulting response.",
          );
          this.throwOnGraphQlErrors(payload, X_DELETE_TWEET_OPERATION);
        }

        await page.waitForTimeout(1_500);
        await this.throwIfBrowserBlocked(page);
        return {
          finalUrl: page.url(),
          source,
        };
      },
    });
    const result = execution.value;

    await this.persistBrowserWriteSuccess(session, probe, "X browser-backed delete flow succeeded.");

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "delete",
      message: `X post deleted for ${session.account} through a browser-backed flow.`,
      id: target.tweetId,
      url: result.finalUrl ?? target.url,
      user: probe.user,
      sessionPath: path,
      data: {
        target: target.tweetId,
      },
    }, execution);
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
      throw new MikaCliError("INVALID_SEARCH_QUERY", "Expected a non-empty X search query.");
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
      throw new MikaCliError("X_TWEET_NOT_FOUND", "X could not load that post.", {
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
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "X session has expired.", {
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

  private async prepareBrowserWriteSession(account?: string): Promise<{ session: PlatformSession; path: string; probe: XProbe }> {
    const { session, path } = await this.prepareSession(account);
    const probe = await this.ensureActiveSession(session);
    return {
      session,
      path,
      probe,
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
        "user-agent": "Mozilla/5.0 MikaCLI/0.1",
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
      "user-agent": "Mozilla/5.0 MikaCLI/0.1",
    });
  }

  private async resolveBearerToken(
    session: PlatformSession,
    client: Awaited<ReturnType<XAdapter["createXClient"]>>,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const configured = process.env.MIKACLI_X_BEARER_TOKEN;
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
      throw new MikaCliError("X_BEARER_TOKEN_NOT_FOUND", "Failed to locate the X main web bundle.");
    }

    const scriptBody = await fetch(mainScriptUrl).then((response) => response.text());
    const token = scriptBody.match(/AAAA[A-Za-z0-9%]{80,}/u)?.[0];

    if (!token) {
      throw new MikaCliError("X_BEARER_TOKEN_NOT_FOUND", "Failed to extract the X web bearer token.");
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
      throw new MikaCliError("SESSION_EXPIRED", "X csrf token is missing. Re-import cookies.txt.");
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
      throw new MikaCliError("MEDIA_UPLOAD_FAILED", "X media upload did not return a media ID.");
    }

    const appendHeaders = await this.buildXUploadHeaders(client, bearerToken, X_HOME);

    const appendForm = new FormData();
    appendForm.set("command", "APPEND");
    appendForm.set("media_id", mediaId);
    appendForm.set("segment_index", "0");
    appendUploadFileField(appendForm, "media", media);

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
      throw new MikaCliError("MEDIA_UPLOAD_PROCESSING", "X media upload is still processing. Retry in a few seconds.", {
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
      throw new MikaCliError("X_WEB_BUNDLE_NOT_FOUND", "Failed to locate the X web app bundle.");
    }

    const scriptBody = await fetch(mainScriptUrl).then((response) => response.text());
    const pattern = new RegExp(`queryId:"([^"]+)",operationName:"${operationName}"`, "u");
    const queryId = scriptBody.match(pattern)?.[1];
    if (!queryId) {
      throw new MikaCliError("X_GRAPHQL_OPERATION_NOT_FOUND", `Failed to locate the X ${operationName} operation ID.`);
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

  private throwOnGraphQlErrors(response: { errors?: XGraphQlError[] }, operationName: string): void {
    const firstError = response.errors?.[0];
    if (!firstError) {
      return;
    }

    if (firstError.code === 34) {
      throw new MikaCliError("X_RESOURCE_NOT_FOUND", `X could not find the requested resource for ${operationName} (code 34).`, {
        details: {
          operation: operationName,
          code: firstError.code,
          upstreamMessage: firstError.message,
        },
      });
    }

    if (firstError.code === 144) {
      throw new MikaCliError("X_TWEET_NOT_FOUND", "X could not find the target tweet (code 144).", {
        details: {
          operation: operationName,
          code: firstError.code,
          upstreamMessage: firstError.message,
        },
      });
    }

    if (firstError.code === 344) {
      throw new MikaCliError(
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
      throw new MikaCliError(
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

    throw new MikaCliError(`X_${operationName.toUpperCase()}_FAILED`, firstError.message ?? `X ${operationName} failed.`, {
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

  private buildBrowserWriteSteps(actionLabel: string, targetUrl: string, forceShared: boolean) {
    const sharedStep = {
      source: "shared" as const,
      announceLabel: `Opening shared MikaCLI browser profile for X ${actionLabel}: ${targetUrl}`,
    };

    if (forceShared) {
      return [sharedStep];
    }

    return [
      {
        source: "headless" as const,
        shouldContinueOnError: (error: unknown) => shouldRetryXBrowserWrite(error),
      },
      sharedStep,
    ];
  }

  private async persistBrowserWriteSuccess(session: PlatformSession, probe: XProbe, message: string): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: {
        state: "active",
        message,
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private waitForBrowserMutationResponse(
    page: PlaywrightPage,
    operationName: string,
    timeoutSeconds: number,
  ): Promise<PlaywrightResponse | undefined> {
    return page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes(`/${operationName}`),
      { timeout: Math.min(timeoutSeconds * 1_000, 30_000) },
    ).catch(() => undefined);
  }

  private async readBrowserMutationPayload<T>(response: PlaywrightResponse, errorMessage: string): Promise<T> {
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!payload || typeof payload !== "object") {
      throw new MikaCliError("X_BROWSER_ACTION_FAILED", errorMessage, {
        details: {
          status: response.status(),
          url: response.url(),
        },
      });
    }

    return payload;
  }

  private async ensureBrowserAuthenticated(page: PlaywrightPage): Promise<void> {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1_000);

    if (isXLoginUrl(page.url())) {
      throw new MikaCliError("X_BROWSER_NOT_LOGGED_IN", "The browser session is not logged into X. Run `mikacli social x login --browser` first.");
    }

    const loginInputs = page.locator('input[autocomplete="username"], input[name="text"], input[autocomplete="current-password"]');
    if ((await loginInputs.count().catch(() => 0)) > 0) {
      throw new MikaCliError("X_BROWSER_NOT_LOGGED_IN", "The browser session is not logged into X. Run `mikacli social x login --browser` first.");
    }

    await this.throwIfBrowserBlocked(page);
  }

  private async openComposer(page: PlaywrightPage): Promise<void> {
    const composerVisible = await this.hasVisibleBrowserLocator(page, [
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="tweetTextarea_0"] div[role="textbox"]',
      'div[role="textbox"][contenteditable="true"]',
    ]);
    if (composerVisible) {
      return;
    }

    const trigger = await firstVisibleXLocator(page, [
      '[data-testid="SideNav_NewTweet_Button"]',
      'a[href="/compose/post"]',
      'a[href="/compose/tweet"]',
    ]);
    await trigger.click();
    await page.waitForTimeout(800);
    await firstVisibleXLocator(page, [
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="tweetTextarea_0"] div[role="textbox"]',
      'div[role="textbox"][contenteditable="true"]',
    ]);
  }

  private async fillBrowserComposerText(page: PlaywrightPage, text: string): Promise<void> {
    const composer = await firstVisibleXLocator(page, [
      '[data-testid="tweetTextarea_0"] div[role="textbox"]',
      '[data-testid="tweetTextarea_0"]',
      'div[role="textbox"][contenteditable="true"]',
    ]);
    await composer.click();
    await page.keyboard.press("Meta+A").catch(() => {});
    await page.keyboard.type(text, { delay: 12 });
    await page.waitForTimeout(400);
  }

  private async attachBrowserComposerImage(page: PlaywrightPage, imagePath: string): Promise<void> {
    const input = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
    if (!(await input.count().catch(() => 0))) {
      throw new MikaCliError("X_BROWSER_UPLOAD_INPUT_MISSING", "X did not show an image upload field in the browser composer.");
    }

    await input.setInputFiles(imagePath);
    await page.waitForTimeout(1_500);
  }

  private async waitForBrowserTweetArticle(page: PlaywrightPage, tweetId?: string): Promise<PlaywrightLocator> {
    const article = tweetId
      ? page.locator("article").filter({
          has: page.locator(`a[href*="/status/${tweetId}"]`),
        }).first()
      : page.locator("article").first();
    try {
      await article.waitFor({ state: "visible", timeout: 15_000 });
      return article;
    } catch (error) {
      throw new MikaCliError("X_BROWSER_TWEET_NOT_FOUND", "X did not render the target post in the browser view.", {
        cause: error,
        details: {
          url: page.url(),
        },
      });
    }
  }

  private async readBrowserLikeState(root: PlaywrightPage | PlaywrightLocator): Promise<"liked" | "unliked" | "unknown"> {
    if (await hasVisibleXLocatorWithin(root, ['[data-testid="unlike"]'])) {
      return "liked";
    }

    if (await hasVisibleXLocatorWithin(root, ['[data-testid="like"]'])) {
      return "unliked";
    }

    return "unknown";
  }

  private async confirmBrowserUnlikeIfNeeded(page: PlaywrightPage): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const confirmButton = await firstVisibleXLocator(page, [
        '[data-testid="confirmationSheetConfirm"]',
        'div[role="dialog"] [data-testid="confirmationSheetConfirm"]',
      ]).catch(() => null);
      if (confirmButton) {
        await confirmButton.click();
        return;
      }

      await page.waitForTimeout(250);
    }
  }

  private async waitForBrowserLikeState(
    page: PlaywrightPage,
    root: PlaywrightPage | PlaywrightLocator,
    expectedState: "liked" | "unliked",
    timeoutMs = 5_000,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if ((await this.readBrowserLikeState(root)) === expectedState) {
        return true;
      }

      await page.waitForTimeout(250);
    }

    return (await this.readBrowserLikeState(root)) === expectedState;
  }

  private async readBrowserMutationPayloadIfReady(
    page: PlaywrightPage,
    responsePromise: Promise<PlaywrightResponse | undefined>,
    timeoutMs = 2_500,
  ): Promise<PlaywrightResponse | undefined> {
    return Promise.race([
      responsePromise,
      page.waitForTimeout(timeoutMs).then(() => undefined),
    ]);
  }

  private async throwIfBrowserBlocked(page: PlaywrightPage): Promise<void> {
    const bodyText = normalizeWhitespace(await page.locator("body").innerText().catch(() => ""));
    if (!bodyText) {
      return;
    }

    const knownPatterns = [
      /something went wrong/i,
      /we noticed unusual activity/i,
      /automated/i,
      /try again later/i,
      /your post was not sent/i,
      /cannot post right now/i,
    ];

    for (const pattern of knownPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        throw new MikaCliError("X_BROWSER_ACTION_FAILED", match[0], {
          details: {
            url: page.url(),
          },
        });
      }
    }
  }

  private async hasVisibleBrowserLocator(page: PlaywrightPage, selectors: readonly string[]): Promise<boolean> {
    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible().catch(() => false)) {
          return true;
        }
      }
    }

    return false;
  }

  private buildBrowserTweetUrl(username: string | undefined, tweetId: string | undefined, currentUrl: string): string | undefined {
    if (currentUrl.includes("/status/")) {
      return currentUrl;
    }

    if (username && tweetId) {
      return `${X_ORIGIN}/${username}/status/${tweetId}`;
    }

    return undefined;
  }

  private async resolveBrowserUsername(page: PlaywrightPage): Promise<string | undefined> {
    const profileLink = page.locator('a[data-testid="AppTabBar_Profile_Link"], a[aria-label*="Profile" i]').first();
    const href = await profileLink.getAttribute("href").catch(() => null);
    if (!href) {
      return undefined;
    }

    const match = href.match(/^\/([A-Za-z0-9_]+)(?:\/|$)/u);
    return match?.[1];
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
      throw new MikaCliError("X_PROFILE_NOT_FOUND", "X could not load that profile.", {
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

    throw new MikaCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: lastError,
      details: lastError instanceof Error ? { message: lastError.message } : undefined,
    });
  }
}

async function firstVisibleXLocator(page: PlaywrightPage, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  throw new MikaCliError("X_BROWSER_ELEMENT_NOT_FOUND", `Could not find any visible X browser element for selectors: ${selectors.join(", ")}`);
}

async function firstVisibleXLocatorWithin(root: PlaywrightPage | PlaywrightLocator, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = root.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  throw new MikaCliError("X_BROWSER_ELEMENT_NOT_FOUND", `Could not find any visible X browser element for selectors: ${selectors.join(", ")}`);
}

async function hasVisibleXLocatorWithin(root: PlaywrightPage | PlaywrightLocator, selectors: readonly string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = root.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) {
        return true;
      }
    }
  }

  return false;
}

function isXLoginUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/i/flow/login") || parsed.pathname === "/login";
  } catch {
    return url.includes("/i/flow/login") || url.includes("/login");
  }
}

function shouldRetryXBrowserWrite(error: unknown): boolean {
  if (!(error instanceof MikaCliError)) {
    return false;
  }

  return [
    "BROWSER_PROFILE_IN_USE",
    "X_BROWSER_NOT_LOGGED_IN",
    "X_BROWSER_ACTION_FAILED",
    "X_BROWSER_ELEMENT_NOT_FOUND",
    "X_BROWSER_POST_BUTTON_DISABLED",
    "X_BROWSER_CREATE_TWEET_TIMEOUT",
  ].includes(error.code);
}

async function firstVisibleXMenuItem(page: PlaywrightPage, namePattern: RegExp): Promise<PlaywrightLocator> {
  const items = page.getByRole("menuitem");
  const count = await items.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = items.nth(index);
    const text = normalizeWhitespace(await candidate.innerText().catch(() => ""));
    if (namePattern.test(text) && (await candidate.isVisible().catch(() => false))) {
      return candidate;
    }
  }

  throw new MikaCliError("X_BROWSER_ELEMENT_NOT_FOUND", `Could not find a visible X menu item matching ${namePattern}.`);
}

async function firstVisibleXDialogButton(page: PlaywrightPage, namePattern: RegExp): Promise<PlaywrightLocator> {
  const buttons = page.getByRole("button");
  const count = await buttons.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = buttons.nth(index);
    const text = normalizeWhitespace(await candidate.innerText().catch(() => ""));
    if (namePattern.test(text) && (await candidate.isVisible().catch(() => false))) {
      return candidate;
    }
  }

  throw new MikaCliError("X_BROWSER_ELEMENT_NOT_FOUND", `Could not find a visible X dialog button matching ${namePattern}.`);
}
