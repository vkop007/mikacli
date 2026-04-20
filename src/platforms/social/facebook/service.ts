import { access } from "node:fs/promises";
import { resolve } from "node:path";

import { MikaCliError } from "../../../errors.js";
import {
  runFirstClassBrowserAction,
  withBrowserActionMetadata,
} from "../../../core/runtime/browser-action-runtime.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import { parseFacebookTarget } from "../../../utils/targets.js";
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
import type { Locator as PlaywrightLocator, Page as PlaywrightPage } from "playwright-core";

const FACEBOOK_ORIGIN = getPlatformOrigin("facebook");
const FACEBOOK_HOME = getPlatformHomeUrl("facebook");
const FACEBOOK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface FacebookProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

type FacebookBrowserSource = "headless" | "profile" | "shared";
type FacebookLikeState = "liked" | "unliked";

export function normalizeFacebookText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function buildFacebookBrowserTarget(target: string): {
  objectId: string;
  url: string;
} {
  const trimmed = target.trim();
  const genericTimeline = tryBuildGenericFacebookTimelineTarget(trimmed);
  if (genericTimeline) {
    return genericTimeline;
  }

  const parsed = parseFacebookTarget(trimmed);
  if (parsed.url) {
    return {
      objectId: parsed.objectId,
      url: parsed.url,
    };
  }

  const compound = parsed.objectId.split("_");
  if (compound.length === 2 && compound[0] && compound[1]) {
    return {
      objectId: parsed.objectId,
      url: `${FACEBOOK_ORIGIN}/permalink.php?story_fbid=${compound[1]}&id=${compound[0]}`,
    };
  }

  return {
    objectId: parsed.objectId,
    url: `${FACEBOOK_ORIGIN}/${parsed.objectId}`,
  };
}

export function extractFacebookPostIdFromMutationBody(body: string | undefined | null): string | undefined {
  if (typeof body !== "string" || body.length === 0) {
    return undefined;
  }

  for (const pattern of [
    /"story_fbid":"?(\d+)"/u,
    /story_fbid=(\d+)/u,
    /"top_level_post_id":"?(\d+)"/u,
    /"legacy_fbid":"?(\d+)"/u,
    /\/posts\/(\d+)/u,
  ]) {
    const match = body.match(pattern)?.[1];
    if (match) {
      return match;
    }
  }

  return undefined;
}

export class FacebookAdapter extends BasePlatformAdapter {
  readonly platform = "facebook" as const;

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
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "Facebook session has expired.", {
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
          ? `Saved Facebook session for ${account}.`
          : `Saved Facebook session for ${account}, but homepage validation was partial.`,
      user: probe.user,
      sessionPath,
      data: {
        status: probe.status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);
    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: probe.status,
      user: probe.user ?? session.user,
    });
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: `Facebook session is ${status.status}.`,
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
      browser: input.browser,
      browserTimeoutSeconds: input.browserTimeoutSeconds,
    });
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    const { session, path } = await this.ensureSavedSession(input.account);
    const text = normalizeFacebookText(input.text);
    const imagePath = input.imagePath ? resolve(input.imagePath) : undefined;

    if (!text && !imagePath) {
      throw new MikaCliError("INVALID_POST_TEXT", "Expected post text, an image, or both for the Facebook post.");
    }

    if (imagePath) {
      await this.assertReadableUploadFile(
        imagePath,
        "FACEBOOK_POST_IMAGE_MISSING",
        "Expected a readable image file for the Facebook post.",
      );
    }

    const timeoutSeconds = input.browserTimeoutSeconds ?? 90;
    const execution = await runFirstClassBrowserAction<{
      finalUrl?: string;
      postId?: string;
      postUrl?: string;
      source: FacebookBrowserSource;
    }>({
      platform: this.platform,
      action: "post",
      actionLabel: "post",
      targetUrl: FACEBOOK_HOME,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: FACEBOOK_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: this.buildBrowserWriteSteps("posting", FACEBOOK_HOME, Boolean(input.browser)),
      actionFn: async (page, source) => {
        await this.ensureFacebookBrowserAuthenticated(page);
        await this.dismissFacebookTransientPrompts(page);

        const actorId = this.getFacebookActorId(session);
        const profileUrl =
          (await this.resolveFacebookTimelineUrl(page).catch(() => undefined)) ??
          session.user?.profileUrl;

        await this.openFacebookPostComposer(page);
        if (text) {
          await this.fillFacebookComposerText(page, text);
        }
        if (imagePath) {
          await this.attachFacebookComposerImage(page, imagePath);
        }

        const responsePromise = this.waitForFacebookMutationResponse(page, {
          timeoutSeconds,
          text,
        });
        const submitButton = await this.waitForEnabledFacebookPostButton(page);
        await clickFacebookLocator(submitButton);

        const response = await responsePromise;
        const responseBody = response ? await response.text().catch(() => undefined) : undefined;
        await this.waitForFacebookComposerToSettle(page);
        const published = await this.findPublishedFacebookPost(page, {
          actorId,
          profileUrl,
          responseBody,
          text,
        });

        return {
          finalUrl: published.postUrl ?? published.profileUrl ?? page.url(),
          postId: published.postId,
          postUrl: published.postUrl,
          source,
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "post",
      message: `Facebook post created for ${session.account} through a browser-backed flow.`,
      id: execution.value.postId,
      url: execution.value.finalUrl,
      user: session.user,
      sessionPath: path,
      data: {
        text,
        imagePath,
        postUrl: execution.value.postUrl,
      },
    }, execution);
  }

  async like(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path } = await this.ensureSavedSession(input.account);
    const target = buildFacebookBrowserTarget(input.target);
    const timeoutSeconds = input.browserTimeoutSeconds ?? 75;

    const execution = await runFirstClassBrowserAction<{
      finalUrl?: string;
      alreadyLiked?: boolean;
      source: FacebookBrowserSource;
    }>({
      platform: this.platform,
      action: "like",
      actionLabel: "like",
      targetUrl: target.url,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: FACEBOOK_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: this.buildBrowserWriteSteps("liking", target.url, Boolean(input.browser)),
      actionFn: async (page, source) => {
        await this.openFacebookTargetPage(page, target.url);

        const initialState = await this.readFacebookLikeState(page).catch(() => "unliked" as const);
        if (initialState === "liked") {
          return {
            alreadyLiked: true,
            finalUrl: page.url(),
            source,
          };
        }

        const control = await this.findFacebookLikeControl(page);
        await clickFacebookLocator(control.locator);
        const liked = await this.waitForFacebookLikeState(page, "liked");
        if (!liked && !control.kind.startsWith("text")) {
          throw new MikaCliError("FACEBOOK_BROWSER_ACTION_FAILED", "Facebook did not confirm the like action in the browser flow.", {
            details: {
              target: input.target,
              url: page.url(),
            },
          });
        }

        return {
          finalUrl: page.url(),
          source,
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: execution.value.alreadyLiked
        ? `Facebook post was already liked for ${session.account} in the browser-backed flow.`
        : `Facebook post liked for ${session.account} through a browser-backed flow.`,
      id: target.objectId,
      url: execution.value.finalUrl ?? target.url,
      user: session.user,
      sessionPath: path,
      data: {
        target: target.objectId,
        alreadyLiked: Boolean(execution.value.alreadyLiked),
      },
    }, execution);
  }

  async comment(input: CommentInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const { session, path } = await this.ensureSavedSession(input.account);
    const target = buildFacebookBrowserTarget(input.target);
    const text = normalizeFacebookText(input.text);
    if (!text) {
      throw new MikaCliError("INVALID_COMMENT_TEXT", "Expected non-empty text for the Facebook comment.");
    }

    const timeoutSeconds = input.browserTimeoutSeconds ?? 75;
    const execution = await runFirstClassBrowserAction<{
      finalUrl?: string;
      source: FacebookBrowserSource;
    }>({
      platform: this.platform,
      action: "comment",
      actionLabel: "comment",
      targetUrl: target.url,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: FACEBOOK_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps: this.buildBrowserWriteSteps("commenting", target.url, Boolean(input.browser)),
      actionFn: async (page, source) => {
        await this.openFacebookTargetPage(page, target.url);
        const textbox = await this.findFacebookCommentTextbox(page);
        await clickFacebookLocator(textbox);
        await page.keyboard.type(text, { delay: 12 });

        const responsePromise = this.waitForFacebookMutationResponse(page, {
          timeoutSeconds,
          text,
        });
        await page.keyboard.press("Enter");
        await responsePromise;
        await this.waitForFacebookCommentEcho(page, text);

        return {
          finalUrl: page.url(),
          source,
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `Facebook comment sent for ${session.account} through a browser-backed flow.`,
      id: target.objectId,
      url: execution.value.finalUrl ?? target.url,
      user: session.user,
      sessionPath: path,
      data: {
        text,
        target: target.objectId,
      },
    }, execution);
  }

  private async ensureSavedSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    const probe = await this.probeSession(loaded.session);
    await this.persistSessionState(loaded.session, probe);

    if (probe.status.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "Facebook session has expired.", {
        details: {
          platform: this.platform,
          account: loaded.session.account,
          sessionPath: loaded.path,
        },
      });
    }

    return loaded;
  }

  private async probeSession(session: PlatformSession): Promise<FacebookProbe> {
    const client = await this.createFacebookClient(session);
    const cUser = await client.getCookieValue("c_user", FACEBOOK_HOME);
    const xs = await client.getCookieValue("xs", FACEBOOK_HOME);

    if (!cUser || !xs) {
      return {
        status: {
          state: "expired",
          message: "Missing required Facebook auth cookies. Re-import cookies.txt from a logged-in browser session.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const html = await client.request<string>(FACEBOOK_HOME, {
        responseType: "text",
        expectedStatus: 200,
        headers: {
          "user-agent": FACEBOOK_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      if (this.looksLoggedOut(html)) {
        return {
          status: {
            state: "expired",
            message: "Facebook returned a logged-out homepage. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "LOGGED_OUT",
          },
        };
      }

      const user = this.extractUser(cUser, html);
      return {
        status: {
          state: "active",
          message: "Session validated via the Facebook homepage.",
          lastValidatedAt: new Date().toISOString(),
        },
        user,
        metadata: this.extractMetadata(cUser, html),
      };
    } catch {
      return {
        status: {
          state: "unknown",
          message: "Facebook auth cookies are present, but homepage validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: {
          id: cUser,
        },
      };
    }
  }

  private async createFacebookClient(session: PlatformSession) {
    return this.createClient(session, {
      origin: FACEBOOK_ORIGIN,
      referer: FACEBOOK_HOME,
      "user-agent": FACEBOOK_USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
    });
  }

  private async persistSessionState(session: PlatformSession, probe: FacebookProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private buildBrowserWriteSteps(actionLabel: string, targetUrl: string, useSharedBrowser: boolean) {
    const sharedStep = {
      source: "shared" as const,
      announceLabel: `Opening shared MikaCLI browser profile for Facebook ${actionLabel}: ${targetUrl}`,
    };

    return useSharedBrowser
      ? [sharedStep]
      : [
          {
            source: "headless" as const,
            shouldContinueOnError: () => true,
          },
          sharedStep,
        ];
  }

  private async assertReadableUploadFile(filePath: string, code: string, message: string): Promise<void> {
    try {
      await access(filePath);
    } catch (error) {
      throw new MikaCliError(code, message, {
        cause: error,
        details: {
          path: filePath,
        },
      });
    }
  }

  private getFacebookActorId(session: PlatformSession): string | undefined {
    if (typeof session.metadata?.actorId === "string" && session.metadata.actorId) {
      return session.metadata.actorId;
    }

    return session.user?.id;
  }

  private async ensureFacebookBrowserAuthenticated(page: PlaywrightPage): Promise<void> {
    await page.waitForTimeout(1_000);

    const loggedOut =
      page.url().includes("/login") ||
      await page.locator('form#login_form, input[name="email"], input[name="pass"], button[name="login"]').first().isVisible().catch(() => false);

    if (loggedOut) {
      throw new MikaCliError(
        "SESSION_EXPIRED",
        "Facebook opened a logged-out browser state. Re-login with `mikacli social facebook login --browser` or refresh the saved cookies first.",
        {
          details: {
            url: page.url(),
          },
        },
      );
    }
  }

  private async dismissFacebookTransientPrompts(page: PlaywrightPage): Promise<void> {
    for (const selector of [
      'div[role="button"]:has-text("Not now")',
      'button:has-text("Not now")',
      'div[role="button"][aria-label="Close"]',
    ]) {
      const locator = page.locator(selector).first();
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      await locator.click().catch(async () => {
        await locator.dispatchEvent("click").catch(() => {});
      });
      await page.waitForTimeout(400);
    }
  }

  private async resolveFacebookTimelineUrl(page: PlaywrightPage): Promise<string | undefined> {
    for (const selector of [
      'a[aria-label*="timeline"]',
      'a[href*="facebook.com/"][aria-label*="timeline"]',
    ]) {
      const locator = page.locator(selector).first();
      const href = await locator.getAttribute("href").catch(() => null);
      if (href) {
        return href.startsWith("http") ? href : new URL(href, FACEBOOK_ORIGIN).toString();
      }
    }

    return undefined;
  }

  private async openFacebookPostComposer(page: PlaywrightPage): Promise<PlaywrightLocator> {
    const trigger = await firstVisibleFacebookLocator(page, [
      '[aria-label="Create a post"][role="region"] div[role="button"]',
      'div[role="button"]:has-text("What\'s on your mind")',
      '[aria-label="Create a post"][role="region"]',
    ]);
    await clickFacebookLocator(trigger);
    await page.waitForTimeout(1_200);
    return this.waitForFacebookComposerTextbox(page);
  }

  private async waitForFacebookComposerTextbox(page: PlaywrightPage): Promise<PlaywrightLocator> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      for (const selector of [
        'div[role="dialog"] [role="textbox"][contenteditable="true"]',
        '[role="textbox"][contenteditable="true"]',
      ]) {
        const locator = page.locator(selector);
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const candidate = locator.nth(index);
          const visible = await candidate.isVisible().catch(() => false);
          if (!visible) {
            continue;
          }

          return candidate;
        }
      }

      await page.waitForTimeout(250);
    }

    throw new MikaCliError("FACEBOOK_BROWSER_COMPOSER_MISSING", "Facebook did not open the create-post composer in the browser flow.", {
      details: {
        url: page.url(),
      },
    });
  }

  private async fillFacebookComposerText(page: PlaywrightPage, text: string): Promise<void> {
    const textbox = await this.waitForFacebookComposerTextbox(page);
    await clickFacebookLocator(textbox);
    await page.keyboard.press("Meta+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.type(text, { delay: 12 });
    await page.waitForTimeout(400);
  }

  private async attachFacebookComposerImage(page: PlaywrightPage, imagePath: string): Promise<void> {
    let input = page.locator('div[role="dialog"] input[type="file"], input[type="file"]');
    let count = await input.count().catch(() => 0);

    if (count === 0) {
      const addMediaButton = await firstVisibleFacebookLocator(page, [
        'div[role="dialog"] div[role="button"]:has-text("Photo/video")',
        'div[role="dialog"] div[role="button"]:has-text("Photo")',
        'div[role="dialog"] div[role="button"][aria-label*="Photo/video"]',
        'div[role="dialog"] div[role="button"][aria-label*="Photo"]',
      ]);
      await clickFacebookLocator(addMediaButton);
      await page.waitForTimeout(800);
      input = page.locator('div[role="dialog"] input[type="file"], input[type="file"]');
      count = await input.count().catch(() => 0);
    }

    if (count === 0) {
      throw new MikaCliError("FACEBOOK_BROWSER_UPLOAD_INPUT_MISSING", "Facebook did not show an image upload field in the browser composer.");
    }

    await input.last().setInputFiles(imagePath);
    await page.waitForTimeout(2_500);
  }

  private async waitForEnabledFacebookPostButton(page: PlaywrightPage): Promise<PlaywrightLocator> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      for (const selector of [
        'div[role="dialog"] div[role="button"]:has-text("Post")',
        'div[aria-label="Post"][role="button"]',
        'button:has-text("Post")',
      ]) {
        const locator = page.locator(selector);
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const candidate = locator.nth(index);
          const visible = await candidate.isVisible().catch(() => false);
          if (!visible) {
            continue;
          }

          const label = normalizeFacebookText(await readFacebookLocatorLabel(candidate));
          const ariaDisabled = await candidate.getAttribute("aria-disabled").catch(() => null);
          const disabled = ariaDisabled === "true" || (await candidate.isEnabled().catch(() => true)) === false;
          if (disabled) {
            continue;
          }

          if (label === "Post" || label.endsWith(" Post")) {
            return candidate;
          }
        }
      }

      await page.waitForTimeout(250);
    }

    throw new MikaCliError("FACEBOOK_BROWSER_POST_BUTTON_DISABLED", "Facebook never enabled the Post button for the browser-backed composer.");
  }

  private async waitForFacebookMutationResponse(
    page: PlaywrightPage,
    input: {
      timeoutSeconds: number;
      text?: string;
    },
  ) {
    const snippets = [input.text, encodeURIComponent(input.text ?? "")]
      .map((value) => (typeof value === "string" ? value.slice(0, 32) : ""))
      .filter(Boolean);

    return page.waitForResponse(
      (response) => {
        const request = response.request();
        if (request.method().toUpperCase() !== "POST" || !response.url().includes("facebook.com")) {
          return false;
        }

        if (snippets.length === 0) {
          return response.url().includes("/api/graphql") || response.url().includes("/ajax/");
        }

        const body = request.postData() ?? "";
        return snippets.some((snippet) => body.includes(snippet));
      },
      {
        timeout: Math.min(input.timeoutSeconds * 1_000, 20_000),
      },
    ).catch(() => null);
  }

  private async waitForFacebookComposerToSettle(page: PlaywrightPage): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const textboxVisible = await page.locator('div[role="dialog"] [role="textbox"][contenteditable="true"]').first().isVisible().catch(() => false);
      if (!textboxVisible) {
        return;
      }

      await page.waitForTimeout(400);
    }
  }

  private async findPublishedFacebookPost(
    page: PlaywrightPage,
    input: {
      actorId?: string;
      profileUrl?: string;
      responseBody?: string;
      text: string;
    },
  ): Promise<{
    postId?: string;
    postUrl?: string;
    profileUrl?: string;
  }> {
    const postId = extractFacebookPostIdFromMutationBody(input.responseBody);
    if (postId) {
      return {
        postId,
        postUrl: buildFacebookPostUrl({
          actorId: input.actorId,
          profileUrl: input.profileUrl,
          postId,
        }),
        profileUrl: input.profileUrl,
      };
    }

    if (!input.profileUrl) {
      return {
        profileUrl: undefined,
      };
    }

    await page.goto(input.profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    }).catch(() => {});
    await page.waitForTimeout(2_500);

    const snippet = input.text.slice(0, 80);
    const postUrl = await page.evaluate((textSnippet) => {
      if (!textSnippet) {
        return null;
      }

      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="story_fbid="], a[href*="/posts/"], a[href*="/permalink.php"]'),
      );
      for (const anchor of anchors) {
        let current: HTMLElement | null = anchor;
        for (let depth = 0; current && depth < 8; depth += 1) {
          const text = (current.innerText || current.textContent || "").replace(/\s+/gu, " ").trim();
          if (text.includes(textSnippet)) {
            return anchor.href;
          }
          current = current.parentElement;
        }
      }

      return null;
    }, snippet).catch(() => null);

    const target = typeof postUrl === "string" ? parseFacebookTarget(postUrl) : null;
    return {
      postId: target?.objectId,
      postUrl: typeof postUrl === "string" ? postUrl : undefined,
      profileUrl: input.profileUrl,
    };
  }

  private async openFacebookTargetPage(page: PlaywrightPage, targetUrl: string): Promise<void> {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    }).catch(() => {});
    await page.waitForTimeout(1_500);
    await this.ensureFacebookBrowserAuthenticated(page);
    await this.dismissFacebookTransientPrompts(page);
  }

  private async findFacebookLikeControl(page: PlaywrightPage): Promise<{
    kind: "button" | "text-like" | "text-liked";
    locator: PlaywrightLocator;
  }> {
    const candidates = page.locator('div[role="button"], button, a[role="button"]');
    const count = Math.min(await candidates.count().catch(() => 0), 200);
    let best: { locator: PlaywrightLocator; y: number } | null = null;

    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      const label = normalizeFacebookText(await readFacebookLocatorLabel(candidate));
      if (!label || !/^(like|liked|remove like)$/iu.test(label)) {
        continue;
      }

      const box = await candidate.boundingBox().catch(() => null);
      const y = box?.y ?? Number.POSITIVE_INFINITY;
      if (y < 120) {
        continue;
      }

      if (!best || y < best.y) {
        best = { locator: candidate, y };
      }
    }

    if (best) {
      return {
        kind: "button",
        locator: best.locator,
      };
    }

    const textCandidates = page.locator("body *");
    const textCount = Math.min(await textCandidates.count().catch(() => 0), 600);
    let textBest: {
      kind: "text-like" | "text-liked";
      locator: PlaywrightLocator;
      y: number;
      area: number;
    } | null = null;

    for (let index = 0; index < textCount; index += 1) {
      const candidate = textCandidates.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      const label = normalizeFacebookText(await candidate.innerText().catch(() => ""));
      const kind = resolveFacebookLikeTextKind(label);
      if (!kind) {
        continue;
      }

      const box = await candidate.boundingBox().catch(() => null);
      const y = box?.y ?? Number.POSITIVE_INFINITY;
      if (y < 120) {
        continue;
      }

      const area = Math.max((box?.width ?? 0) * (box?.height ?? 0), 1);
      if (!textBest || y < textBest.y || (y === textBest.y && area < textBest.area)) {
        textBest = {
          kind,
          locator: candidate,
          y,
          area,
        };
      }
    }

    if (textBest) {
      return {
        kind: textBest.kind,
        locator: textBest.locator,
      };
    }

    for (const candidate of [
      { kind: "text-liked" as const, locator: page.locator('text=/^Liked$/').first() },
      { kind: "text-like" as const, locator: page.locator('text=/^Like$/').first() },
    ]) {
      const visible = await candidate.locator.isVisible().catch(() => false);
      if (visible) {
        return candidate;
      }
    }

    throw new MikaCliError("FACEBOOK_BROWSER_LIKE_BUTTON_MISSING", "Facebook did not render a visible Like control for the target post.");
  }

  private async readFacebookLikeState(page: PlaywrightPage): Promise<FacebookLikeState> {
    const control = await this.findFacebookLikeControl(page);
    if (control.kind === "text-liked") {
      return "liked";
    }
    if (control.kind === "text-like") {
      return "unliked";
    }

    const button = control.locator;
    const label = normalizeFacebookText(await readFacebookLocatorLabel(button));
    const ariaPressed = await button.getAttribute("aria-pressed").catch(() => null);
    if (ariaPressed === "true" || /liked|remove like/iu.test(label)) {
      return "liked";
    }

    return "unliked";
  }

  private async waitForFacebookLikeState(page: PlaywrightPage, expected: FacebookLikeState): Promise<boolean> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const state = await this.readFacebookLikeState(page).catch(() => null);
      if (state === expected) {
        return true;
      }

      await page.waitForTimeout(300);
    }

    return false;
  }

  private async findFacebookCommentTextbox(page: PlaywrightPage): Promise<PlaywrightLocator> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      for (const selector of [
        'div[role="textbox"][contenteditable="true"][aria-label*="Comment"]',
        '[aria-label^="Comment as"][role="textbox"]',
        'div[role="textbox"][contenteditable="true"]',
      ]) {
        const locator = page.locator(selector);
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const candidate = locator.nth(index);
          const visible = await candidate.isVisible().catch(() => false);
          if (!visible) {
            continue;
          }

          const box = await candidate.boundingBox().catch(() => null);
          if ((box?.y ?? 0) < 120) {
            continue;
          }

          return candidate;
        }
      }

      await page.waitForTimeout(250);
    }

    throw new MikaCliError("FACEBOOK_BROWSER_COMMENT_BOX_MISSING", "Facebook did not render a visible comment box for the target post.");
  }

  private async waitForFacebookCommentEcho(page: PlaywrightPage, text: string): Promise<void> {
    const snippet = text.slice(0, 80);
    if (!snippet) {
      return;
    }

    await page.waitForFunction((commentSnippet) => document.body.innerText.includes(commentSnippet), snippet, {
      timeout: 15_000,
    }).catch(() => {});
  }

  private looksLoggedOut(html: string): boolean {
    return (
      html.includes('name="login"') ||
      html.includes('id="login_form"') ||
      html.includes("Create new account") ||
      html.includes("Forgot password?") ||
      html.includes("/login/?next=")
    );
  }

  private extractUser(cUser: string, html: string): SessionUser {
    const username =
      this.extractFirst(html, /"vanity":"([^"]+)"/u) ??
      this.extractFirst(html, /"username":"([^"]+)"/u) ??
      undefined;
    const displayName =
      this.extractFirst(html, /"NAME":"([^"]+)"/u) ??
      this.extractFirst(html, /"short_name":"([^"]+)"/u) ??
      undefined;

    return {
      id: cUser,
      username,
      displayName,
      profileUrl: username ? `${FACEBOOK_ORIGIN}/${username}` : undefined,
    };
  }

  private extractMetadata(cUser: string, html: string): Record<string, unknown> {
    const fbDtsg =
      this.extractFirst(html, /DTSGInitData[\s\S]*?"token":"([^"]+)"/u) ??
      this.extractFirst(html, /name="fb_dtsg" value="([^"]+)"/u);
    const lsd =
      this.extractFirst(html, /"LSD"[\s\S]*?"token":"([^"]+)"/u) ??
      this.extractFirst(html, /name="lsd" value="([^"]+)"/u);

    return {
      actorId: cUser,
      ...(fbDtsg ? { fbDtsg } : {}),
      ...(lsd ? { lsd } : {}),
    };
  }

  private extractFirst(input: string, pattern: RegExp): string | undefined {
    return input.match(pattern)?.[1];
  }
}

function buildFacebookPostUrl(input: {
  actorId?: string;
  profileUrl?: string;
  postId: string;
}): string {
  const profileUrl = input.profileUrl?.trim();
  if (profileUrl) {
    return `${profileUrl.replace(/\/+$/u, "")}/posts/${input.postId}`;
  }

  if (input.actorId) {
    return `${FACEBOOK_ORIGIN}/permalink.php?story_fbid=${input.postId}&id=${input.actorId}`;
  }

  return `${FACEBOOK_ORIGIN}/${input.postId}`;
}

function tryBuildGenericFacebookTimelineTarget(target: string): { objectId: string; url: string } | null {
  try {
    const url = new URL(target);
    if (!/(\.|^)facebook\.com$/iu.test(url.hostname)) {
      return null;
    }

    if (url.pathname === "/profile.php") {
      const id = url.searchParams.get("id")?.trim();
      if (id) {
        return {
          objectId: id,
          url: target,
        };
      }
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 1 && !(segments[0] ?? "").includes(".php")) {
      return {
        objectId: decodeURIComponent(segments[0] ?? target),
        url: target,
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function readFacebookLocatorLabel(locator: PlaywrightLocator): Promise<string> {
  const ariaLabel = await locator.getAttribute("aria-label").catch(() => null);
  const text = await locator.innerText().catch(() => "");
  return normalizeFacebookText([ariaLabel ?? "", text].filter(Boolean).join(" "));
}

async function clickFacebookLocator(locator: PlaywrightLocator): Promise<void> {
  await locator.click().catch(async () => {
    await locator.dispatchEvent("click");
  });
}

async function firstVisibleFacebookLocator(
  page: PlaywrightPage,
  selectors: readonly string[],
): Promise<PlaywrightLocator> {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      if (visible) {
        return candidate;
      }
    }
  }

  throw new MikaCliError("FACEBOOK_BROWSER_SELECTOR_MISSING", `Facebook did not render an expected browser control for selectors: ${selectors.join(", ")}`);
}

function resolveFacebookLikeTextKind(label: string): "text-like" | "text-liked" | null {
  if (/^like$/iu.test(label)) {
    return "text-like";
  }

  if (/^(liked|remove like)$/iu.test(label)) {
    return "text-liked";
  }

  return null;
}
