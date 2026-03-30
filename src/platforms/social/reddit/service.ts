import { sanitizeAccountName } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import { htmlToText, normalizeWhitespace } from "../../data/shared/text.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";
import { normalizeSocialLimit } from "../shared/options.js";
import {
  buildOldRedditThreadUrl,
  buildRedditThreadUrl,
  buildRedditUserUrl,
  normalizeRedditSubredditTarget,
  normalizeRedditThingTarget,
  normalizeRedditThreadTarget,
  normalizeRedditUsernameTarget,
} from "./helpers.js";
import { runBackgroundBrowserAction, runSharedBrowserAction } from "../../../utils/browser-cookie-login.js";

import type { Page as PlaywrightPage } from "playwright-core";
import type { SessionHttpClient } from "../../../utils/http-client.js";
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

const REDDIT_ORIGIN = "https://www.reddit.com";
const OLD_REDDIT_ORIGIN = "https://old.reddit.com";
const REDDIT_USER_AGENT = "AutoCLI/0.1 (+https://github.com/vkop007/autocli)";
const REDDIT_BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

type RedditListingChild<T> = {
  kind?: string;
  data?: T;
};

type RedditListing<T> = {
  kind?: string;
  data?: {
    children?: Array<RedditListingChild<T>>;
  };
};

type RedditUserData = {
  id?: string;
  name?: string;
  title?: string;
  subreddit?: {
    title?: string;
    public_description?: string;
    subscribers?: number;
    url?: string;
  };
  total_karma?: number;
  link_karma?: number;
  comment_karma?: number;
  created_utc?: number;
  icon_img?: string;
  modhash?: string;
};

type RedditMeResponse = {
  data?: RedditUserData & {
    modhash?: string;
  };
};

type RedditPostData = {
  id?: string;
  name?: string;
  title?: string;
  selftext?: string;
  selftext_html?: string;
  author?: string;
  subreddit?: string;
  subreddit_name_prefixed?: string;
  permalink?: string;
  url?: string;
  domain?: string;
  created_utc?: number;
  num_comments?: number;
  score?: number;
  upvote_ratio?: number;
  saved?: boolean;
};

type RedditCommentData = {
  id?: string;
  name?: string;
  body?: string;
  body_html?: string;
  author?: string;
  permalink?: string;
  link_title?: string;
  subreddit?: string;
  subreddit_name_prefixed?: string;
  created_utc?: number;
  score?: number;
  saved?: boolean;
  replies?: "" | RedditListing<RedditCommentData>;
};

type RedditApiEnvelope = {
  json?: {
    errors?: unknown[];
    data?: {
      id?: string;
      name?: string;
      url?: string;
      things?: Array<{
        data?: {
          id?: string;
          name?: string;
          permalink?: string;
        };
      }>;
    };
  };
};

type RedditSessionProbe = {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
  me?: RedditUserData;
};

type RedditWriteOptions = {
  account?: string;
  browser?: boolean;
  browserTimeoutSeconds?: number;
};

type RedditSubmitInput = RedditWriteOptions & {
  subreddit: string;
  title: string;
  text?: string;
  url?: string;
  nsfw?: boolean;
  spoiler?: boolean;
};

type RedditCommentActionInput = RedditWriteOptions & {
  target: string;
  text: string;
};

type RedditThingActionInput = RedditWriteOptions & {
  target: string;
};

export class RedditAdapter extends BasePlatformAdapter {
  readonly platform = "reddit" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const provisionalSession: PlatformSession = {
      version: 1,
      platform: this.platform,
      account: input.account ?? "default",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: imported.source,
      status: { state: "unknown" },
      cookieJar: serializeCookieJar(imported.jar),
    };

    const probe = await this.probeSession(provisionalSession);
    const account = sanitizeAccountName(input.account?.trim() || probe.user?.username || probe.user?.id || "default");
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Reddit rejected the saved web session.", {
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
          ? `Saved Reddit session for ${account}.`
          : `Saved Reddit session for ${account}, but validation is limited.`,
      user: probe.user,
      sessionPath,
      data: {
        status: probe.status.state,
        profile: probe.me ? mapRedditUserToProfile(probe.me) : undefined,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadSession(account);
    const probe = await this.probeSession(loaded.session);
    await this.persistExistingSession(loaded.session, {
      user: probe.user ?? loaded.session.user,
      status: probe.status,
      metadata: {
        ...(loaded.session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });

    return this.buildStatusResult({
      account: loaded.session.account,
      sessionPath: loaded.path,
      status: probe.status,
      user: probe.user ?? loaded.session.user,
    });
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: `Reddit session is ${status.status}.`,
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

  async me(account?: string): Promise<AdapterActionResult> {
    const loaded = await this.ensureAvailableSession(account);
    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "me",
      message: `Loaded Reddit account ${loaded.session.account}.`,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        profile: loaded.probe.me ? mapRedditUserToProfile(loaded.probe.me) : undefined,
      },
    };
  }

  async search(input: { query: string; limit?: number; subreddit?: string }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("REDDIT_QUERY_REQUIRED", "Provide a Reddit query to search.");
    }

    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const subreddit = input.subreddit ? normalizeRedditSubredditTarget(input.subreddit) : undefined;
    const url = subreddit
      ? new URL(`${REDDIT_ORIGIN}/r/${encodeURIComponent(subreddit)}/search.json`)
      : new URL(`${REDDIT_ORIGIN}/search.json`);

    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("sort", "relevance");
    url.searchParams.set("t", "all");
    url.searchParams.set("raw_json", "1");
    if (subreddit) {
      url.searchParams.set("restrict_sr", "1");
    }

    const response = await this.fetchPublicJson<RedditListing<RedditPostData>>(url.toString());
    const items = ((response.data?.children ?? []) as Array<RedditListingChild<RedditPostData>>)
      .map((entry) => mapRedditPost(entry.data))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${items.length} Reddit result${items.length === 1 ? "" : "s"} for "${query}".`,
      data: {
        query,
        subreddit,
        items,
      },
    };
  }

  async profileInfo(input: { target: string }): Promise<AdapterActionResult> {
    const resolved = normalizeRedditUsernameTarget(input.target);
    const response = await this.fetchPublicJson<{ data?: RedditUserData }>(
      `${REDDIT_ORIGIN}/user/${encodeURIComponent(resolved.username)}/about.json?raw_json=1`,
    );
    const profile = response.data;
    if (!profile?.name) {
      throw new AutoCliError("REDDIT_PROFILE_NOT_FOUND", `Reddit could not find user "${resolved.username}".`);
    }

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "profile",
      message: `Loaded Reddit profile ${profile.name}.`,
      id: profile.id,
      url: buildRedditUserUrl(profile.name),
      user: {
        id: profile.id,
        username: profile.name,
        displayName: profile.title || profile.name,
        profileUrl: buildRedditUserUrl(profile.name),
      },
      data: {
        profile: mapRedditUserToProfile(profile),
      },
    };
  }

  async posts(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = normalizeRedditUsernameTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 25);
    const listing = await this.fetchPublicJson<RedditListing<RedditPostData>>(
      `${REDDIT_ORIGIN}/user/${encodeURIComponent(resolved.username)}/submitted.json?limit=${limit}&raw_json=1`,
    );
    const items = ((listing.data?.children ?? []) as Array<RedditListingChild<RedditPostData>>)
      .map((entry) => mapRedditPost(entry.data))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .slice(0, limit);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "posts",
      message: `Loaded ${items.length} Reddit post${items.length === 1 ? "" : "s"} for ${resolved.username}.`,
      data: {
        target: resolved.username,
        items,
      },
    };
  }

  async threadInfo(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const resolved = normalizeRedditThreadTarget(input.target);
    const limit = normalizeSocialLimit(input.limit, 5, 50);
    const response = await this.fetchPublicJson<[RedditListing<RedditPostData>, RedditListing<RedditCommentData>]>(
      `${REDDIT_ORIGIN}/comments/${encodeURIComponent(resolved.postId)}.json?limit=${limit}&raw_json=1`,
    );

    const postData = response[0]?.data?.children?.[0]?.data;
    const thread = mapRedditPost(postData);
    if (!thread) {
      throw new AutoCliError("REDDIT_THREAD_NOT_FOUND", "Reddit could not load the requested thread.");
    }

    const replies = collectRedditComments(response[1]?.data?.children ?? [], limit);
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "thread",
      message: `Loaded Reddit thread ${resolved.postId}.`,
      id: resolved.postId,
      url: typeof thread.url === "string" ? thread.url : buildRedditThreadUrl(resolved),
      data: {
        thread,
        replies,
      },
    };
  }

  async submitPost(input: RedditSubmitInput): Promise<AdapterActionResult> {
    const title = input.title.trim();
    if (!title) {
      throw new AutoCliError("REDDIT_POST_TITLE_REQUIRED", "Provide a title for the Reddit post.");
    }

    const subreddit = normalizeRedditSubredditTarget(input.subreddit);
    const isLinkPost = typeof input.url === "string" && input.url.trim().length > 0;
    const text = input.text?.trim();
    if (!isLinkPost && !text) {
      throw new AutoCliError("REDDIT_POST_TEXT_REQUIRED", "Provide post text or use --url for a link post.");
    }

    if (input.browser) {
      return this.browserSubmitPost({
        ...input,
        subreddit,
        title,
        text,
      });
    }

    return this.httpSubmitPost({
      ...input,
      subreddit,
      title,
      text,
    });
  }

  override async comment(input: CommentInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    return this.commentOnThread({
      account: input.account,
      target: input.target,
      text: input.text,
      browser: input.browser,
      browserTimeoutSeconds: input.browserTimeoutSeconds,
    });
  }

  async commentOnThread(input: RedditCommentActionInput): Promise<AdapterActionResult> {
    const text = input.text.trim();
    if (!text) {
      throw new AutoCliError("REDDIT_COMMENT_TEXT_REQUIRED", "Provide comment text.");
    }

    if (input.browser) {
      return this.browserComment(input);
    }

    return this.httpComment(input);
  }

  override async like(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    return this.upvote({
      account: input.account,
      target: input.target,
      browser: input.browser,
      browserTimeoutSeconds: input.browserTimeoutSeconds,
    });
  }

  async upvote(input: RedditThingActionInput): Promise<AdapterActionResult> {
    if (input.browser) {
      return this.browserUpvote(input);
    }

    return this.httpVote(input, 1);
  }

  async savePost(input: RedditThingActionInput): Promise<AdapterActionResult> {
    if (input.browser) {
      return this.browserSave(input);
    }

    return this.httpSave(input);
  }

  override async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Use `autocli social reddit post <subreddit> <title> <text...>` to submit a Reddit post.");
  }

  override async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw new AutoCliError("UNSUPPORTED_ACTION", "Reddit media upload is not implemented yet. Use link or text posts for now.");
  }

  private async httpSubmitPost(input: RedditSubmitInput): Promise<AdapterActionResult> {
    const body = new URLSearchParams({
      api_type: "json",
      kind: input.url ? "link" : "self",
      sr: input.subreddit,
      title: input.title,
      text: input.url ? "" : input.text ?? "",
      url: input.url?.trim() ?? "",
      resubmit: "true",
      sendreplies: "true",
      nsfw: input.nsfw ? "true" : "false",
      spoiler: input.spoiler ? "true" : "false",
    });

    const { envelope, loaded } = await this.performWriteRequest(input.account, "/api/submit", body, `${REDDIT_ORIGIN}/r/${encodeURIComponent(input.subreddit)}/submit`);
    const targetUrl =
      envelope.json?.data?.url && /^https?:\/\//iu.test(envelope.json.data.url)
        ? envelope.json.data.url
        : envelope.json?.data?.url
          ? `${REDDIT_ORIGIN}${envelope.json.data.url}`
          : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "post",
      message: `Submitted Reddit post to r/${input.subreddit}.`,
      id: envelope.json?.data?.id,
      url: targetUrl,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        subreddit: input.subreddit,
        title: input.title,
        kind: input.url ? "link" : "self",
        url: targetUrl,
      },
    };
  }

  private async httpComment(input: RedditCommentActionInput): Promise<AdapterActionResult> {
    const resolved = normalizeRedditThingTarget(input.target);
    const body = new URLSearchParams({
      api_type: "json",
      thing_id: resolved.fullname,
      text: input.text.trim(),
    });

    const { envelope, loaded } = await this.performWriteRequest(
      input.account,
      "/api/comment",
      body,
      resolved.url ?? buildRedditThreadUrl(resolved),
    );
    const created = envelope.json?.data?.things?.[0]?.data;
    const url = created?.permalink ? `${REDDIT_ORIGIN}${created.permalink}` : resolved.url;

    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "comment",
      message: `Posted Reddit comment on ${resolved.fullname}.`,
      id: created?.id,
      url,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        target: resolved.fullname,
        commentId: created?.id,
        url,
      },
    };
  }

  private async httpVote(input: RedditThingActionInput, direction: 1 | 0 | -1): Promise<AdapterActionResult> {
    const resolved = normalizeRedditThingTarget(input.target);
    const body = new URLSearchParams({
      api_type: "json",
      id: resolved.fullname,
      dir: String(direction),
    });

    const { loaded } = await this.performWriteRequest(input.account, "/api/vote", body, resolved.url ?? buildRedditThreadUrl(resolved));
    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "upvote",
      message: `Applied Reddit vote to ${resolved.fullname}.`,
      id: resolved.fullname,
      url: resolved.url,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        target: resolved.fullname,
        direction,
      },
    };
  }

  private async httpSave(input: RedditThingActionInput): Promise<AdapterActionResult> {
    const resolved = normalizeRedditThingTarget(input.target);
    const body = new URLSearchParams({
      api_type: "json",
      id: resolved.fullname,
    });

    const { loaded } = await this.performWriteRequest(input.account, "/api/save", body, resolved.url ?? buildRedditThreadUrl(resolved));
    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "save",
      message: `Saved Reddit item ${resolved.fullname}.`,
      id: resolved.fullname,
      url: resolved.url,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        target: resolved.fullname,
      },
    };
  }

  private async browserSubmitPost(input: RedditSubmitInput): Promise<AdapterActionResult> {
    const loaded = await this.ensureAvailableSession(input.account);
    const submitUrl = `${REDDIT_ORIGIN}/r/${encodeURIComponent(input.subreddit)}/submit${input.url ? "?type=LINK" : "?type=TEXT"}`;
    const result = await runBackgroundBrowserAction({
      targetUrl: submitUrl,
      timeoutSeconds: input.browserTimeoutSeconds ?? 60,
      initialCookies: loaded.session.cookieJar.cookies,
      headless: true,
      userAgent: REDDIT_BROWSER_USER_AGENT,
      locale: "en-US",
      action: async (page) => {
        await this.ensureBrowserAuthenticated(page);
        await this.throwIfBrowserBlocked(page);

        const titleInput = await firstVisibleLocator(page, [
          'faceplate-textarea-input[name="title"] textarea',
          'faceplate-textarea-input[name="title"] [role="textbox"]',
          '[name="title"] textarea',
          '[name="title"] [role="textbox"]',
        ]);
        await titleInput.fill(input.title.trim());
        await page.waitForTimeout(300);

        if (input.url?.trim()) {
          const urlInput = await firstVisibleLocator(page, ['input[type="url"]', 'input[name="url"]', 'input[placeholder*="link" i]', 'input[placeholder*="url" i]']);
          await urlInput.fill(input.url.trim());
        } else if (input.text?.trim()) {
          const bodyInput = await firstVisibleLocator(page, [
            'div[role="textbox"][aria-label*="Body text" i]',
            'div[role="textbox"][aria-label*="Optional Body" i]',
            '[role="textbox"][name="body"]',
          ]);
          await bodyInput.fill(input.text.trim());
        }

        if (input.nsfw) {
          await checkIfPresent(page, ['input[name="nsfw"]', 'input[id*="nsfw"]', 'button[aria-label*="nsfw" i]', '[role="checkbox"][aria-label*="nsfw" i]']);
        }
        if (input.spoiler) {
          await checkIfPresent(page, ['input[name="spoiler"]', 'input[id*="spoiler"]', 'button[aria-label*="spoiler" i]', '[role="checkbox"][aria-label*="spoiler" i]']);
        }

        const submitButton = await firstVisibleLocator(page, [
          'r-post-form-submit-button#submit-post-button button',
          '#submit-post-button button',
          'button:has-text("Post")',
          'button[type="submit"]',
        ]);
        await submitButton.click();
        await page.waitForTimeout(3_000);
        await this.throwIfBrowserBlocked(page);
        await this.throwIfModernRedditErrorVisible(page, "Reddit rejected the post submission.");
        return {
          finalUrl: await this.resolveModernPostUrl(page, input.title.trim()),
        };
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "post",
      message: `Submitted Reddit post to r/${input.subreddit} through an invisible browser session.`,
      url: result.finalUrl,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        subreddit: input.subreddit,
        title: input.title,
        kind: input.url ? "link" : "self",
      },
    };
  }

  private async browserComment(input: RedditCommentActionInput): Promise<AdapterActionResult> {
    const loaded = await this.ensureAvailableSession(input.account);
    const resolved = normalizeRedditThingTarget(input.target);
    const targetUrl = resolved.url ? resolved.url.replace(REDDIT_ORIGIN, OLD_REDDIT_ORIGIN) : buildOldRedditThreadUrl(resolved);
    const result = await runSharedBrowserAction({
      targetUrl,
      timeoutSeconds: input.browserTimeoutSeconds ?? 60,
      announceLabel: `Opening shared AutoCLI browser profile for Reddit commenting: ${targetUrl}`,
      initialCookies: loaded.session.cookieJar.cookies,
      action: async (page) => {
        await this.ensureBrowserAuthenticated(page);
        const thing = await this.findBrowserThing(page, resolved.fullname);
        const replyTrigger = thing.locator('.reply-button a, a[onclick*="reply"]');
        if (await replyTrigger.count()) {
          await replyTrigger.first().click().catch(() => {});
          await page.waitForTimeout(300);
        }

        const textArea = await firstVisibleLocatorWithin(thing, ['textarea[name="text"]', "textarea"]);
        await textArea.fill(input.text.trim());
        const submitButton = await firstVisibleLocatorWithin(thing, ['button[name="submit"]', 'input[type="submit"][name="submit"]', 'button[type="submit"]']);
        await submitButton.click();
        await page.waitForTimeout(1_500);
        await this.throwIfOldRedditErrorVisible(page, "Reddit rejected the comment submission.");
        return {
          finalUrl: page.url(),
        };
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "comment",
      message: `Posted Reddit comment on ${resolved.fullname} through the shared browser profile.`,
      id: resolved.fullname,
      url: result.finalUrl,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        target: resolved.fullname,
      },
    };
  }

  private async browserUpvote(input: RedditThingActionInput): Promise<AdapterActionResult> {
    const loaded = await this.ensureAvailableSession(input.account);
    const resolved = normalizeRedditThingTarget(input.target);
    const targetUrl = resolved.url ? resolved.url.replace(REDDIT_ORIGIN, OLD_REDDIT_ORIGIN) : buildOldRedditThreadUrl(resolved);
    const result = await runSharedBrowserAction({
      targetUrl,
      timeoutSeconds: input.browserTimeoutSeconds ?? 60,
      announceLabel: `Opening shared AutoCLI browser profile for Reddit voting: ${targetUrl}`,
      initialCookies: loaded.session.cookieJar.cookies,
      action: async (page) => {
        await this.ensureBrowserAuthenticated(page);
        const thing = await this.findBrowserThing(page, resolved.fullname);
        const button = await firstVisibleLocatorWithin(thing, [".arrow.up", 'button[aria-label*="upvote" i]']);
        await button.click();
        await page.waitForTimeout(500);
        return {
          finalUrl: page.url(),
        };
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "upvote",
      message: `Upvoted Reddit item ${resolved.fullname} through the shared browser profile.`,
      id: resolved.fullname,
      url: result.finalUrl,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        target: resolved.fullname,
      },
    };
  }

  private async browserSave(input: RedditThingActionInput): Promise<AdapterActionResult> {
    const loaded = await this.ensureAvailableSession(input.account);
    const resolved = normalizeRedditThingTarget(input.target);
    const targetUrl = resolved.url ? resolved.url.replace(REDDIT_ORIGIN, OLD_REDDIT_ORIGIN) : buildOldRedditThreadUrl(resolved);
    const result = await runSharedBrowserAction({
      targetUrl,
      timeoutSeconds: input.browserTimeoutSeconds ?? 60,
      announceLabel: `Opening shared AutoCLI browser profile for Reddit save: ${targetUrl}`,
      initialCookies: loaded.session.cookieJar.cookies,
      action: async (page) => {
        await this.ensureBrowserAuthenticated(page);
        const thing = await this.findBrowserThing(page, resolved.fullname);
        const button = await firstVisibleLocatorWithin(thing, ['.save-button a', '.save-button button', 'button[aria-label*="save" i]']);
        await button.click();
        await page.waitForTimeout(500);
        return {
          finalUrl: page.url(),
        };
      },
    });

    return {
      ok: true,
      platform: this.platform,
      account: loaded.session.account,
      action: "save",
      message: `Saved Reddit item ${resolved.fullname} through the shared browser profile.`,
      id: resolved.fullname,
      url: result.finalUrl,
      user: loaded.probe.user ?? loaded.session.user,
      sessionPath: loaded.path,
      data: {
        target: resolved.fullname,
      },
    };
  }

  private async findBrowserThing(page: PlaywrightPage, fullname: string) {
    const specific = page.locator(`.thing[data-fullname="${fullname}"]`);
    if (await specific.count()) {
      const visible = await firstVisibleLocatorWithin(page, [`.thing[data-fullname="${fullname}"]`]);
      return visible;
    }

    if (fullname.startsWith("t3_")) {
      return firstVisibleLocator(page, [".thing.link", ".thing"]);
    }

    throw new AutoCliError("REDDIT_BROWSER_TARGET_NOT_FOUND", `Could not find Reddit item ${fullname} in the shared browser page.`);
  }

  private async ensureBrowserAuthenticated(page: PlaywrightPage): Promise<void> {
    const currentUrl = page.url();
    if (/\/login\/?/iu.test(currentUrl)) {
      throw new AutoCliError(
        "REDDIT_BROWSER_NOT_LOGGED_IN",
        "The shared browser profile is not logged into Reddit. Run `autocli social reddit login --browser` first.",
      );
    }

    const loginFields = page.locator('input[name="username"], input[name="user"], form[action*="/login"] input[type="password"]');
    if (await loginFields.count()) {
      for (let index = 0; index < Math.min(await loginFields.count(), 3); index += 1) {
        if (await loginFields.nth(index).isVisible().catch(() => false)) {
          throw new AutoCliError(
            "REDDIT_BROWSER_NOT_LOGGED_IN",
            "The shared browser profile is not logged into Reddit. Run `autocli social reddit login --browser` first.",
          );
        }
      }
    }
  }

  private async throwIfBrowserBlocked(page: PlaywrightPage): Promise<void> {
    const bodyText = normalizeWhitespace(await page.locator("body").textContent().catch(() => "") || "");
    if (/blocked by network security/i.test(bodyText)) {
      throw new AutoCliError(
        "REDDIT_BROWSER_BLOCKED",
        "Reddit blocked the shared browser session with a network security page.",
        {
          details: {
            url: page.url(),
          },
        },
      );
    }
  }

  private async throwIfOldRedditErrorVisible(page: PlaywrightPage, fallbackMessage: string): Promise<void> {
    const errorBlocks = page.locator('.error, .errors, .status.error, .infobar.error');
    const count = await errorBlocks.count();
    for (let index = 0; index < Math.min(count, 3); index += 1) {
      const block = errorBlocks.nth(index);
      if (!(await block.isVisible().catch(() => false))) {
        continue;
      }

      const text = normalizeWhitespace(await block.textContent().catch(() => "") || "");
      if (text) {
        throw new AutoCliError("REDDIT_BROWSER_ACTION_FAILED", text);
      }
    }

    if (page.url().includes("/submit")) {
      return;
    }

    const bodyText = normalizeWhitespace(await page.locator("body").textContent().catch(() => "") || "");
    if (/sorry, this post was removed/i.test(bodyText) || /you are doing that too much/i.test(bodyText)) {
      throw new AutoCliError("REDDIT_BROWSER_ACTION_FAILED", fallbackMessage, {
        details: {
          url: page.url(),
        },
      });
    }
  }

  private async throwIfModernRedditErrorVisible(page: PlaywrightPage, fallbackMessage: string): Promise<void> {
    const bodyText = normalizeWhitespace(await page.locator("body").textContent().catch(() => "") || "");
    const knownErrors = [
      /something went wrong/i,
      /please fix the above requirements/i,
      /post must contain/i,
      /title is required/i,
      /sorry, this post was removed/i,
      /you are doing that too much/i,
      /unable to create post/i,
    ];

    for (const pattern of knownErrors) {
      const match = bodyText.match(pattern);
      if (match) {
        throw new AutoCliError("REDDIT_BROWSER_ACTION_FAILED", match[0], {
          details: {
            url: page.url(),
          },
        });
      }
    }

    if (isRedditSubmitPath(page.url())) {
      throw new AutoCliError("REDDIT_BROWSER_ACTION_FAILED", fallbackMessage, {
        details: {
          url: page.url(),
        },
      });
    }
  }

  private async resolveModernPostUrl(page: PlaywrightPage, title: string): Promise<string> {
    const currentUrl = page.url();
    if (!isRedditSubmittedPath(currentUrl)) {
      return currentUrl;
    }

    const exactLink = page.locator(`a[href*="/comments/"]`, { hasText: title }).first();
    if (await exactLink.count().catch(() => 0)) {
      const href = await exactLink.getAttribute("href").catch(() => null);
      if (href) {
        return new URL(href, REDDIT_ORIGIN).toString();
      }
    }

    const firstLink = page.locator('a[href*="/comments/"]').first();
    const href = await firstLink.getAttribute("href").catch(() => null);
    if (href) {
      return new URL(href, REDDIT_ORIGIN).toString();
    }

    return currentUrl;
  }

  private async performWriteRequest(account: string | undefined, path: string, body: URLSearchParams, referer: string) {
    const loaded = await this.ensureAvailableSession(account);
    const modhash = loaded.probe.metadata?.modhash;
    if (typeof modhash !== "string" || modhash.length === 0) {
      throw new AutoCliError(
        "REDDIT_MODHASH_MISSING",
        "Reddit write actions need a fresh logged-in session. Re-login with `autocli social reddit login --browser` or import fresher cookies.",
      );
    }

    body.set("uh", modhash);
    body.set("raw_json", "1");

    const client = await this.createClient(loaded.session, this.buildRequestHeaders({
      origin: REDDIT_ORIGIN,
      referer,
      contentType: "application/x-www-form-urlencoded; charset=UTF-8",
      extra: {
        "x-requested-with": "XMLHttpRequest",
      },
    }));

    const { data, response } = await this.requestTextWithStatus(client, `${REDDIT_ORIGIN}${path}`, {
      method: "POST",
      body: body.toString(),
      expectedStatus: [200, 400, 401, 403],
    });

    if (response.status === 401 || response.status === 403) {
      const status = this.expiredStatus("Reddit rejected the saved web session.");
      await this.persistExistingSession(loaded.session, {
        user: loaded.probe.user ?? loaded.session.user,
        status,
        metadata: {
          ...(loaded.session.metadata ?? {}),
          ...(loaded.probe.metadata ?? {}),
        },
      });
      throw new AutoCliError("SESSION_EXPIRED", status.message ?? "Reddit rejected the saved web session.", {
        details: {
          platform: this.platform,
          account: loaded.session.account,
          sessionPath: loaded.path,
          status: response.status,
        },
      });
    }

    const envelope = safeJsonParse<RedditApiEnvelope>(data);
    this.assertWriteEnvelopeSuccess(envelope);

    await this.persistExistingSession(loaded.session, {
      user: loaded.probe.user ?? loaded.session.user,
      status: this.activeStatus("Reddit web session validated."),
      metadata: {
        ...(loaded.session.metadata ?? {}),
        ...(loaded.probe.metadata ?? {}),
      },
    });

    return {
      envelope,
      loaded,
    };
  }

  private async ensureAvailableSession(account?: string): Promise<{
    session: PlatformSession;
    path: string;
    probe: RedditSessionProbe;
  }> {
    const loaded = await this.loadSession(account);
    const probe = await this.probeSession(loaded.session);
    await this.persistExistingSession(loaded.session, {
      user: probe.user ?? loaded.session.user,
      status: probe.status,
      metadata: {
        ...(loaded.session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "Reddit rejected the saved web session.", {
        details: {
          platform: this.platform,
          account: loaded.session.account,
          sessionPath: loaded.path,
        },
      });
    }

    return {
      session: loaded.session,
      path: loaded.path,
      probe,
    };
  }

  private async probeSession(session: PlatformSession): Promise<RedditSessionProbe> {
    const client = await this.createClient(session, this.buildRequestHeaders());
    const { data } = await this.requestTextWithStatus(client, `${REDDIT_ORIGIN}/api/me.json?raw_json=1`, {
      expectedStatus: [200, 401, 403],
    });

    const parsed = safeJsonParse<RedditMeResponse>(data);
    const me = parsed.data;
    if (!me?.name) {
      return {
        status: this.expiredStatus("Reddit rejected the saved web session."),
      };
    }

    return {
      status: this.activeStatus("Reddit web session validated."),
      user: {
        id: me.id,
        username: me.name,
        displayName: me.title || me.name,
        profileUrl: buildRedditUserUrl(me.name),
      },
      metadata: {
        modhash: me.modhash,
      },
      me,
    };
  }

  private async fetchPublicJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: this.buildRequestHeaders(),
      });
    } catch (error) {
      throw new AutoCliError("REDDIT_REQUEST_FAILED", "Failed to load Reddit's public response.", {
        cause: error,
        details: {
          url,
        },
      });
    }

    const text = await response.text();
    if (!response.ok) {
      throw new AutoCliError("REDDIT_REQUEST_FAILED", `Reddit request failed with HTTP ${response.status}.`, {
        details: {
          url,
          status: response.status,
          statusText: response.statusText,
          preview: text.slice(0, 400),
        },
      });
    }

    return safeJsonParse<T>(text);
  }

  private async requestTextWithStatus(
    client: SessionHttpClient,
    url: string,
    input: {
      method?: "GET" | "POST";
      body?: string;
      expectedStatus: number[];
    },
  ): Promise<{ data: string; response: Response }> {
    return client.requestWithResponse<string>(url, {
      method: input.method ?? "GET",
      body: input.body,
      expectedStatus: input.expectedStatus,
      responseType: "text",
    });
  }

  private assertWriteEnvelopeSuccess(payload: RedditApiEnvelope): void {
    const errors = payload.json?.errors;
    if (!Array.isArray(errors) || errors.length === 0) {
      return;
    }

    const first = errors[0];
    if (Array.isArray(first) && first.length >= 2) {
      throw new AutoCliError("REDDIT_WRITE_FAILED", `${String(first[0])}: ${String(first[1])}`);
    }

    throw new AutoCliError("REDDIT_WRITE_FAILED", "Reddit rejected the requested write action.", {
      details: {
        errors,
      },
    });
  }

  private buildRequestHeaders(input: {
    origin?: string;
    referer?: string;
    contentType?: string;
    extra?: Record<string, string>;
  } = {}): Record<string, string> {
    return {
      "user-agent": REDDIT_USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
      accept: "application/json, text/plain, */*",
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.referer ? { referer: input.referer } : {}),
      ...(input.contentType ? { "content-type": input.contentType } : {}),
      ...(input.extra ?? {}),
    };
  }

  private activeStatus(message: string): SessionStatus {
    return {
      state: "active",
      message,
      lastValidatedAt: new Date().toISOString(),
    };
  }

  private expiredStatus(message: string): SessionStatus {
    return {
      state: "expired",
      message,
      lastValidatedAt: new Date().toISOString(),
      lastErrorCode: "REDDIT_SESSION_INVALID",
    };
  }
}

function mapRedditUserToProfile(user: RedditUserData): Record<string, unknown> {
  const username = user.name ?? "unknown";
  const bio = normalizePreview(user.subreddit?.public_description);
  return {
    displayName: user.title || username,
    username,
    bio,
    followers: formatCompactNumber(user.subreddit?.subscribers),
    posts: formatCompactNumber(user.total_karma ?? (user.link_karma ?? 0) + (user.comment_karma ?? 0)),
    url: buildRedditUserUrl(username),
  };
}

function mapRedditPost(post: RedditPostData | undefined): Record<string, unknown> | undefined {
  if (!post?.id) {
    return undefined;
  }

  const text = normalizePreview(post.selftext_html ? htmlToText(post.selftext_html) : post.selftext);
  return {
    id: post.id,
    title: post.title ?? post.id,
    summary: text,
    text,
    username: post.author,
    publishedAt: toIsoTime(post.created_utc),
    url: post.permalink ? `${REDDIT_ORIGIN}${post.permalink}` : post.url,
    metrics: compactMetrics([
      post.subreddit_name_prefixed ?? (post.subreddit ? `r/${post.subreddit}` : undefined),
      formatMetric("score", post.score),
      formatMetric("comments", post.num_comments),
      formatMetric("ratio", typeof post.upvote_ratio === "number" ? `${Math.round(post.upvote_ratio * 100)}%` : undefined),
      post.saved ? "saved" : undefined,
    ]),
  };
}

function mapRedditComment(comment: RedditCommentData | undefined): Record<string, unknown> | undefined {
  if (!comment?.id) {
    return undefined;
  }

  const text = normalizePreview(comment.body_html ? htmlToText(comment.body_html) : comment.body);
  return {
    id: comment.id,
    title: comment.link_title ? `Reply on ${comment.link_title}` : `Comment by ${comment.author ?? "unknown"}`,
    summary: text,
    text,
    username: comment.author,
    publishedAt: toIsoTime(comment.created_utc),
    url: comment.permalink ? `${REDDIT_ORIGIN}${comment.permalink}` : undefined,
    metrics: compactMetrics([
      comment.subreddit_name_prefixed ?? (comment.subreddit ? `r/${comment.subreddit}` : undefined),
      formatMetric("score", comment.score),
      comment.saved ? "saved" : undefined,
    ]),
  };
}

function collectRedditComments(children: ReadonlyArray<RedditListingChild<RedditCommentData>>, limit: number): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];

  const visit = (nodes: ReadonlyArray<RedditListingChild<RedditCommentData>>) => {
    for (const node of nodes) {
      if (items.length >= limit) {
        return;
      }
      if (node.kind !== "t1" || !node.data) {
        continue;
      }

      const mapped = mapRedditComment(node.data);
      if (mapped) {
        items.push(mapped);
      }

      const replies = node.data.replies;
      if (replies && typeof replies === "object" && Array.isArray(replies.data?.children)) {
        visit(replies.data.children);
      }
    }
  };

  visit(children);
  return items.slice(0, limit);
}

function compactMetrics(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function formatMetric(label: string, value: number | string | undefined): string | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return `${label} ${formatCompactNumber(value)}`;
  }

  if (typeof value === "string" && value.length > 0) {
    return `${label} ${value}`;
  }

  return undefined;
}

function normalizePreview(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return undefined;
  }

  return normalized.length > 320 ? `${normalized.slice(0, 317)}...` : normalized;
}

function formatCompactNumber(value: number | undefined | null): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function toIsoTime(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value * 1000).toISOString();
}

function safeJsonParse<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new AutoCliError("REDDIT_INVALID_JSON", "Reddit returned an unreadable response.", {
      cause: error,
      details: {
        preview: value.slice(0, 400),
      },
    });
  }
}

async function firstVisibleLocator(page: PlaywrightPage, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  throw new AutoCliError("REDDIT_BROWSER_ELEMENT_NOT_FOUND", `Could not find any visible Reddit browser element for selectors: ${selectors.join(", ")}`);
}

async function firstVisibleLocatorWithin(scope: { locator(selector: string): ReturnType<PlaywrightPage["locator"]> }, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = scope.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  throw new AutoCliError("REDDIT_BROWSER_ELEMENT_NOT_FOUND", `Could not find any visible Reddit browser element for selectors: ${selectors.join(", ")}`);
}

async function checkIfPresent(page: PlaywrightPage, selectors: readonly string[]): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (!(await locator.count())) {
      continue;
    }

    const candidate = locator.first();
    if (await candidate.isVisible().catch(() => false)) {
      const checked = await candidate.isChecked().catch(() => false);
      if (!checked) {
        await candidate.check().catch(async () => {
          await candidate.click().catch(() => {});
        });
      }
      return;
    }
  }
}

function isRedditSubmitPath(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname === "/submit" || pathname.endsWith("/submit/");
  } catch {
    return url.includes("/submit?");
  }
}

function isRedditSubmittedPath(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().includes("/submitted/");
  } catch {
    return url.includes("/submitted/");
  }
}
