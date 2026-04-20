import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { MikaCliError } from "../errors.js";
import { emitInteractiveProgress } from "./interactive-progress.js";
import {
  DEFAULT_BROWSER_PROFILE,
  ensureBrowserDirectory,
  getBrowserProfileDir,
  getBrowserStatePath,
} from "../config.js";
import {
  getPlatformBrowserAuthCookieNames,
  getPlatformBrowserReadyCookieNames,
  getPlatformBrowserAuthStorageKeys,
  getPlatformCookieDomain,
  getPlatformDisplayName,
  getPlatformHomeUrl,
} from "../platforms/config.js";
import type { Platform } from "../types.js";
import { BROWSER_NODE_REEXEC_ERROR_CODE } from "./node-browser-reexec.js";
import type {
  Browser as PlaywrightBrowser,
  BrowserContext as PlaywrightBrowserContext,
  Page as PlaywrightPage,
  Request as PlaywrightRequest,
  Response as PlaywrightResponse,
} from "playwright-core";

export interface BrowserLoginCapture {
  cookies: unknown[];
  finalUrl: string;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface BrowserTargetInspection {
  browserProfilePath: string;
  finalUrl: string;
  cookies: unknown[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  launchedFresh: boolean;
}

export interface CapturedBrowserRequest {
  id: number;
  method: string;
  url: string;
  resourceType: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  status?: number;
  statusText?: string;
  postData?: string;
  failureText?: string;
}

export interface BrowserNetworkCapture {
  browserProfilePath: string;
  finalUrl: string;
  requests: CapturedBrowserRequest[];
  timedOut: boolean;
  launchedFresh: boolean;
}

type SharedBrowserBootstrapDetector = {
  id: "google";
  displayName: string;
  expectedDomain: string;
  authCookieNames: readonly string[];
  readyCookieNames: readonly string[];
  authStorageKeys: readonly string[];
  loggedOutUrlPatterns: readonly RegExp[];
};

export interface SharedBrowserActionInput<T> {
  targetUrl: string;
  timeoutSeconds?: number;
  announceLabel?: string;
  initialCookies?: unknown[];
  action: (page: PlaywrightPage) => Promise<T>;
}

export interface BackgroundBrowserActionInput<T> {
  targetUrl: string;
  timeoutSeconds?: number;
  initialCookies?: unknown[];
  headless?: boolean;
  userAgent?: string;
  locale?: string;
  action: (page: PlaywrightPage) => Promise<T>;
}

export interface BackgroundBrowserProfileActionInput<T> {
  targetUrl: string;
  timeoutSeconds?: number;
  headless?: boolean;
  profile?: string;
  userAgent?: string;
  locale?: string;
  action: (page: PlaywrightPage) => Promise<T>;
}

export type BrowserActionSource = "headless" | "profile" | "shared";

export interface BrowserActionPlanStep {
  source: BrowserActionSource;
  announceLabel?: string;
  shouldContinueOnError?: (error: unknown) => boolean;
}

export interface BrowserActionPlanInput<T> {
  targetUrl: string;
  timeoutSeconds?: number;
  initialCookies?: unknown[];
  headless?: boolean;
  profile?: string;
  userAgent?: string;
  locale?: string;
  steps: readonly BrowserActionPlanStep[];
  action: (page: PlaywrightPage, source: BrowserActionSource) => Promise<T>;
}

type ManagedBrowserState = {
  pid: number;
  port: number;
  cdpUrl: string;
  browserProfilePath: string;
  executablePath: string;
  startedAt: string;
};

type ManagedBrowserHandle = {
  state: ManagedBrowserState;
  launchedFresh: boolean;
};

type ManagedBrowserVersionInfo = {
  browser?: string;
  userAgent?: string;
  webSocketDebuggerUrl?: string;
};

type ManagedBrowserProcessCandidate = {
  pid: number;
  port: number;
  executablePath: string;
};

const execFileAsync = promisify(execFile);

type ConnectedBrowser = {
  browser: PlaywrightBrowser;
  context: PlaywrightBrowserContext;
};

type BrowserContextLike = PlaywrightBrowserContext;
type BrowserPageLike = PlaywrightPage;

export interface BrowserExecutableProbe {
  available: boolean;
  path?: string;
  source: "env" | "system";
  error?: string;
  candidates?: string[];
}

const WEAK_BROWSER_AUTH_COOKIE_NAMES = new Set([
  "_gh_sess",
  "_gitlab_session",
  "JSESSIONID",
  "atlassian.xsrf.token",
  "csrftoken",
  "ct0",
]);

const BOOLEAN_BROWSER_AUTH_COOKIE_NAMES = new Set([
  "logged_in",
  "is_logged_in",
]);

const FALSEY_AUTH_COOKIE_VALUES = new Set([
  "",
  "0",
  "false",
  "no",
  "null",
  "undefined",
]);

export async function captureBrowserLogin(
  platform: Platform,
  input: {
    browserUrl?: string;
    timeoutSeconds?: number;
  } = {},
): Promise<BrowserLoginCapture> {
  const displayName = getPlatformDisplayName(platform);
  const startUrl = input.browserUrl?.trim() || getPlatformHomeUrl(platform);
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 600) * 1000;
  const authCookieNames = getPlatformBrowserAuthCookieNames(platform);
  const browserReadyCookieNames = getPlatformBrowserReadyCookieNames(platform);
  const authStorageKeys = getPlatformBrowserAuthStorageKeys(platform);
  const expectedDomain = getPlatformCookieDomain(platform);

  const managed = await ensureManagedBrowser({
    browserUrl: startUrl,
    announceLabel: `Opening shared MikaCLI browser profile for ${displayName} login: ${startUrl}`,
  });

  let connected: ConnectedBrowser | null = null;
  try {
    const deadline = Date.now() + timeoutMs;
    let page: BrowserPageLike | null = null;
    let announcedFallback = false;

    announceBrowserLogin(`Browser opened for ${displayName}. Complete the sign-in flow there and MikaCLI will save the session automatically once login is detected.`);

    while (Date.now() < deadline) {
      if (!connected) {
        connected = await tryConnectToManagedBrowser(managed.state.cdpUrl, 2_000);
        if (connected) {
          page = await openOrReusePage(connected.context, startUrl, Math.min(timeoutMs, 15_000));
        } else if (!announcedFallback) {
          announceBrowserLogin(
            `Still waiting to attach to the opened ${displayName} browser window. Keep signing in normally. If MikaCLI is still waiting after you finish, close that browser window and it will import the saved session from the shared profile.`,
          );
          announcedFallback = true;
        }
      }

      if (connected && page) {
        const cookies = await connected.context.cookies();
        const storage = await readStorage(page);
        if (hasDetectedAuthenticatedState(cookies, authCookieNames, authStorageKeys, expectedDomain, storage, browserReadyCookieNames)) {
          return {
            cookies,
            finalUrl: page.url(),
            localStorage: storage.localStorage,
            sessionStorage: storage.sessionStorage,
          };
        }
      }

      if (!(await isManagedBrowserReachable(managed.state))) {
        return await extractBrowserLoginFromProfile({
          platform,
          startUrl,
          profilePath: managed.state.browserProfilePath,
        });
      }

      await sleep(1000);
    }

    throw buildBrowserLoginTimeoutError({
      platform,
      displayName,
      startUrl,
      timeoutMs,
      browserProfilePath: managed.state.browserProfilePath,
    });
  } catch (error) {
    if (error instanceof MikaCliError) {
      throw error;
    }

    throw new MikaCliError(
      "BROWSER_LOGIN_FAILED",
      `Failed to start browser login for ${displayName}.`,
      {
        cause: error,
        details: {
          platform,
          startUrl,
          browserProfilePath: managed.state.browserProfilePath,
          cdpUrl: managed.state.cdpUrl,
        },
      },
    );
  } finally {
    if (connected) {
      await connected.browser.close().catch(() => {});
    }
    if (managed.launchedFresh) {
      await closeManagedBrowser(managed.state).catch(() => {});
    }
  }
}

export async function openSharedBrowserProfile(
  input: {
    browserUrl?: string;
    timeoutSeconds?: number;
  } = {},
): Promise<{
  browserProfilePath: string;
  startUrl: string;
  timedOut: boolean;
  detected: boolean;
  detector?: string;
  finalUrl?: string;
}> {
  const startUrl = input.browserUrl?.trim() || "https://accounts.google.com/";
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 600) * 1000;

  const managed = await ensureManagedBrowser({
    browserUrl: startUrl,
    announceLabel: `Opening shared MikaCLI browser profile: ${startUrl}`,
  });

  announceBrowserLogin("Sign into Google or any other identity provider you want MikaCLI to reuse later. Close the browser window when you are done.");
  const detector = resolveSharedBrowserBootstrapDetector(startUrl);
  if (!detector) {
    const finished = await waitForManagedBrowserCloseOrTimeout(managed.state, timeoutMs);
    return {
      browserProfilePath: managed.state.browserProfilePath,
      startUrl,
      timedOut: !finished,
      detected: false,
    };
  }

  let connected: ConnectedBrowser | null = null;
  let closedManagedBrowser = false;
  let lastFinalUrl: string | undefined;

  try {
    const deadline = Date.now() + timeoutMs;
    let page: BrowserPageLike | null = null;

    while (Date.now() < deadline) {
      if (!connected) {
        connected = await tryConnectToManagedBrowser(managed.state.cdpUrl, 2_000);
        if (connected) {
          page = await openOrReusePage(connected.context, startUrl, Math.min(timeoutMs, 15_000));
        }
      }

      if (connected && page) {
        const cookies = await connected.context.cookies();
        const storage = await readStorage(page);
        lastFinalUrl = page.url();
        if (hasDetectedSharedBrowserBootstrap(detector, {
          finalUrl: lastFinalUrl,
          cookies,
          storage,
        })) {
          if (managed.launchedFresh) {
            await closeManagedBrowser(managed.state).catch(() => {});
            closedManagedBrowser = true;
          }

          return {
            browserProfilePath: managed.state.browserProfilePath,
            startUrl,
            timedOut: false,
            detected: true,
            detector: detector.id,
            finalUrl: lastFinalUrl,
          };
        }
      }

      if (!(await isManagedBrowserReachable(managed.state))) {
        return {
          browserProfilePath: managed.state.browserProfilePath,
          startUrl,
          timedOut: false,
          detected: false,
          finalUrl: lastFinalUrl,
        };
      }

      await sleep(1000);
    }

    return {
      browserProfilePath: managed.state.browserProfilePath,
      startUrl,
      timedOut: true,
      detected: false,
      finalUrl: lastFinalUrl,
    };
  } finally {
    if (connected) {
      await connected.browser.close().catch(() => {});
    }
    if (managed.launchedFresh && !closedManagedBrowser) {
      const stillRunning = await isManagedBrowserReachable(managed.state);
      if (!stillRunning) {
        await clearManagedBrowserState(DEFAULT_BROWSER_PROFILE).catch(() => {});
      }
    }
  }
}

export async function inspectSharedBrowserTarget(input: {
  targetUrl: string;
  timeoutSeconds?: number;
}): Promise<BrowserTargetInspection> {
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 60) * 1000;
  const managed = await requireManagedBrowser({
    announceLabel: `Attaching to the shared MikaCLI browser profile for inspection: ${input.targetUrl}`,
  });

  let connected: ConnectedBrowser | null = null;
  try {
    connected = await connectToManagedBrowser(managed.state.cdpUrl);
    const page = await openOrReusePage(connected.context, input.targetUrl, Math.min(timeoutMs, 10_000));
    await page.waitForTimeout(Math.min(timeoutMs, 1_000));

    const cookies = await connected.context.cookies();
    const storage = await readStorage(page);
    return {
      browserProfilePath: managed.state.browserProfilePath,
      finalUrl: page.url(),
      cookies,
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
      launchedFresh: managed.launchedFresh,
    };
  } finally {
    if (connected) {
      await connected.browser.close().catch(() => {});
    }
    if (managed.launchedFresh) {
      await closeManagedBrowser(managed.state).catch(() => {});
    }
  }
}

export async function captureSharedBrowserNetwork(input: {
  targetUrl: string;
  timeoutSeconds?: number;
  filterDomain?: string;
  filterText?: string;
  limit?: number;
}): Promise<BrowserNetworkCapture> {
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 60) * 1000;
  const limit = Math.max(1, Math.min(200, input.limit ?? 25));
  const managed = await requireManagedBrowser({
    announceLabel: `Attaching to the shared MikaCLI browser profile for capture: ${input.targetUrl}`,
  });

  let connected: ConnectedBrowser | null = null;
  try {
    connected = await connectToManagedBrowser(managed.state.cdpUrl);
    const page = await getOrCreatePage(connected.context, input.targetUrl);
    const requests = attachNetworkCapture(page, {
      filterDomain: input.filterDomain,
      filterText: input.filterText,
    });

    announceBrowserLogin("Interact in the opened browser window. MikaCLI is capturing network requests now.");
    await navigatePage(page, input.targetUrl, Math.min(timeoutMs, 10_000));

    const deadline = Date.now() + timeoutMs;
    let timedOut = true;
    while (Date.now() < deadline) {
      if (!(await isManagedBrowserReachable(managed.state))) {
        timedOut = false;
        break;
      }
      await page.waitForTimeout(500);
    }

    return {
      browserProfilePath: managed.state.browserProfilePath,
      finalUrl: page.url(),
      requests: requests.slice(-limit),
      timedOut,
      launchedFresh: managed.launchedFresh,
    };
  } finally {
    if (connected) {
      await connected.browser.close().catch(() => {});
    }
    if (managed.launchedFresh) {
      await closeManagedBrowser(managed.state).catch(() => {});
    }
  }
}

export async function runSharedBrowserAction<T>(input: SharedBrowserActionInput<T>): Promise<T> {
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 60) * 1000;
  const managed = await ensureManagedBrowser({
    browserUrl: input.targetUrl,
    announceLabel: input.announceLabel ?? `Opening shared MikaCLI browser profile: ${input.targetUrl}`,
  });

  let connected: ConnectedBrowser | null = null;
  try {
    connected = await connectToManagedBrowser(managed.state.cdpUrl);
    if (Array.isArray(input.initialCookies) && input.initialCookies.length > 0) {
      await applyBrowserContextCookies(connected.context, input.initialCookies, {
        targetUrl: input.targetUrl,
      });
    }
    const page = await openOrReusePage(connected.context, input.targetUrl, Math.min(timeoutMs, 10_000));
    return await input.action(page);
  } finally {
    if (connected) {
      await connected.browser.close().catch(() => {});
    }
    if (managed.launchedFresh) {
      await closeManagedBrowser(managed.state).catch(() => {});
    }
  }
}

export async function runBackgroundBrowserAction<T>(input: BackgroundBrowserActionInput<T>): Promise<T> {
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 60) * 1000;
  const executablePath = await resolveBrowserExecutable();
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: input.headless ?? true,
  });

  try {
    const context = await browser.newContext({
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
    });

    if (Array.isArray(input.initialCookies) && input.initialCookies.length > 0) {
      await applyBrowserContextCookies(context, input.initialCookies, {
        targetUrl: input.targetUrl,
      });
    }

    const page = await context.newPage();
    await navigatePage(page, input.targetUrl, Math.min(timeoutMs, 15_000));
    return await input.action(page);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function runBackgroundBrowserProfileAction<T>(input: BackgroundBrowserProfileActionInput<T>): Promise<T> {
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 60) * 1000;
  const profile = input.profile ?? DEFAULT_BROWSER_PROFILE;
  await ensureBrowserDirectory(profile);

  const existing = await readManagedBrowserState(profile);
  if (existing && await isManagedBrowserReachable(existing)) {
    throw new MikaCliError(
      "BROWSER_PROFILE_IN_USE",
      "The shared MikaCLI browser profile is currently open. Close it before running this invisible browser action.",
      {
        details: {
          profile,
          browserProfilePath: getBrowserProfileDir(profile),
        },
      },
    );
  }

  const executablePath = await resolveBrowserExecutable();
  const { chromium } = await import("playwright-core");
  const context = await chromium.launchPersistentContext(getBrowserProfileDir(profile), {
    executablePath,
    headless: input.headless ?? true,
    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
    args: ["--no-first-run", "--no-default-browser-check"],
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await navigatePage(page, input.targetUrl, Math.min(timeoutMs, 15_000));
    return await input.action(page);
  } finally {
    await context.close().catch(() => {});
  }
}

export async function runBrowserActionPlan<T>(input: BrowserActionPlanInput<T>): Promise<T> {
  let lastError: unknown;

  for (const step of input.steps) {
    try {
      switch (step.source) {
        case "headless":
          return await runBackgroundBrowserAction({
            targetUrl: input.targetUrl,
            timeoutSeconds: input.timeoutSeconds,
            initialCookies: input.initialCookies,
            headless: input.headless,
            userAgent: input.userAgent,
            locale: input.locale,
            action: (page) => input.action(page, "headless"),
          });
        case "profile":
          return await runBackgroundBrowserProfileAction({
            targetUrl: input.targetUrl,
            timeoutSeconds: input.timeoutSeconds,
            headless: input.headless,
            profile: input.profile,
            userAgent: input.userAgent,
            locale: input.locale,
            action: (page) => input.action(page, "profile"),
          });
        case "shared":
          return await runSharedBrowserAction({
            targetUrl: input.targetUrl,
            timeoutSeconds: input.timeoutSeconds,
            announceLabel: step.announceLabel,
            initialCookies: input.initialCookies,
            action: (page) => input.action(page, "shared"),
          });
      }
    } catch (error) {
      lastError = error;
      if (!step.shouldContinueOnError?.(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new MikaCliError("BROWSER_ACTION_FAILED", "Browser action plan failed before completing the requested operation.");
}

export function hasDetectedAuthenticatedState(
  cookies: unknown[],
  authCookieNames: readonly string[],
  authStorageKeys: readonly string[],
  expectedDomain: string,
  storage: { localStorage: Record<string, string>; sessionStorage: Record<string, string> },
  readyCookieNames: readonly string[] = [],
): boolean {
  const browserCookies = Array.isArray(cookies) ? cookies : [];
  const matchingDomainCookies = browserCookies.filter((cookie) => {
    if (!cookie || typeof cookie !== "object") {
      return false;
    }

    const domain = "domain" in cookie && typeof cookie.domain === "string" ? cookie.domain : "";
    return domain.replace(/^\./u, "").endsWith(expectedDomain);
  });

  if (authCookieNames.some((pattern) => browserCookies.some((cookie) => isStrongBrowserAuthCookie(cookie, pattern)))) {
    if (readyCookieNames.length === 0) {
      return true;
    }

    return readyCookieNames.every((pattern) => browserCookies.some((cookie) => hasPresentBrowserCookie(cookie, pattern)));
  }

  if (authStorageKeys.some((key) => hasTruthyStorageValue(storage.localStorage[key]) || hasTruthyStorageValue(storage.sessionStorage[key]))) {
    return true;
  }

  if (authCookieNames.length === 0 && authStorageKeys.length === 0 && matchingDomainCookies.length > 0) {
    const localStorageKeys = Object.keys(storage.localStorage);
    const sessionStorageKeys = Object.keys(storage.sessionStorage);
    if (localStorageKeys.length > 0 || sessionStorageKeys.length > 0) {
      return true;
    }
  }

  return false;
}

export function resolveSharedBrowserBootstrapDetector(startUrl: string): SharedBrowserBootstrapDetector | null {
  try {
    const url = new URL(startUrl);
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "accounts.google.com" ||
      hostname === "myaccount.google.com" ||
      hostname === "google.com" ||
      hostname.endsWith(".google.com")
    ) {
      return {
        id: "google",
        displayName: "Google",
        expectedDomain: "google.com",
        authCookieNames: [
          "SID",
          "HSID",
          "SSID",
          "APISID",
          "SAPISID",
          "__Secure-1PSID",
          "__Secure-3PSID",
        ],
        readyCookieNames: ["SID", "HSID"],
        authStorageKeys: [],
        loggedOutUrlPatterns: [
          /accounts\.google\.com\/(?:signin|servicelogin|interactivelogin|logout)/iu,
          /accounts\.google\.com\/v3\/signin/iu,
          /accounts\.google\.com\/v3\/challenge/iu,
        ],
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function hasDetectedSharedBrowserBootstrap(
  detector: SharedBrowserBootstrapDetector,
  input: {
    finalUrl: string;
    cookies: unknown[];
    storage: {
      localStorage: Record<string, string>;
      sessionStorage: Record<string, string>;
    };
  },
): boolean {
  if (detector.loggedOutUrlPatterns.some((pattern) => pattern.test(input.finalUrl))) {
    return false;
  }

  return hasDetectedAuthenticatedState(
    input.cookies,
    detector.authCookieNames,
    detector.authStorageKeys,
    detector.expectedDomain,
    input.storage,
    detector.readyCookieNames,
  );
}

async function ensureManagedBrowser(input: {
  browserUrl: string;
  announceLabel: string;
  profile?: string;
}): Promise<ManagedBrowserHandle> {
  if (process.versions.bun && process.env.MIKACLI_NODE_BROWSER_REEXEC !== "1") {
    throw new MikaCliError(
      BROWSER_NODE_REEXEC_ERROR_CODE,
      "Shared-browser actions need the Node runtime because Bun cannot reliably attach to Chrome over CDP on this machine.",
    );
  }

  const profile = input.profile ?? DEFAULT_BROWSER_PROFILE;
  await ensureBrowserDirectory(profile);
  const browserProfilePath = getBrowserProfileDir(profile);

  const existing = await readManagedBrowserState(profile);
  const reusableExisting = await prepareReusableManagedBrowserState(profile, existing, {
    terminateOnFailure: true,
  });
  if (reusableExisting) {
    announceBrowserLogin(input.announceLabel);
    return {
      state: reusableExisting,
      launchedFresh: false,
    };
  }

  const discovered = await discoverManagedBrowserState(profile, browserProfilePath);
  const reusableDiscovered = await prepareReusableManagedBrowserState(profile, discovered, {
    terminateOnFailure: true,
  });
  if (reusableDiscovered) {
    announceBrowserLogin(input.announceLabel);
    return {
      state: reusableDiscovered,
      launchedFresh: false,
    };
  }

  await cleanupStaleAutomatedBrowserProcesses(browserProfilePath);
  await cleanupStaleBrowserProfileArtifacts(browserProfilePath);

  const executablePath = await resolveBrowserExecutable();
  const port = await getAvailablePort();
  const cdpUrl = `http://127.0.0.1:${port}`;
  const args = [
    `--user-data-dir=${browserProfilePath}`,
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    input.browserUrl,
  ];

  const child = spawn(executablePath, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  const state: ManagedBrowserState = {
    pid: child.pid ?? 0,
    port,
    cdpUrl,
    browserProfilePath,
    executablePath,
    startedAt: new Date().toISOString(),
  };

  try {
    await waitForManagedBrowserReady(state);
    await writeManagedBrowserState(profile, state);
  } catch (error) {
    await closeManagedBrowser(state).catch(() => {});
    await cleanupStaleAutomatedBrowserProcesses(browserProfilePath);
    await cleanupStaleBrowserProfileArtifacts(browserProfilePath);
    throw error;
  }
  announceBrowserLogin(input.announceLabel);
  return {
    state,
    launchedFresh: true,
  };
}

async function connectToManagedBrowser(cdpUrl: string): Promise<ConnectedBrowser> {
  const connected = await tryConnectToManagedBrowser(cdpUrl, 15_000);
  if (connected) {
    return connected;
  }

  throw new MikaCliError("BROWSER_LOGIN_FAILED", "Managed browser started, but MikaCLI could not attach over CDP in time.", {
    details: {
      cdpUrl,
    },
  });
}

async function tryConnectToManagedBrowser(cdpUrl: string, timeoutMs: number): Promise<ConnectedBrowser | null> {
  const { chromium } = await import("playwright-core");

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const versionInfo = await readManagedBrowserVersionInfo(cdpUrl);
      const browser = await chromium.connectOverCDP(resolveManagedBrowserConnectEndpoint(cdpUrl, versionInfo), {
        timeout: Math.max(1_000, Math.min(5_000, deadline - Date.now())),
      });
      const context = browser.contexts()[0];
      if (!context) {
        await browser.close().catch(() => {});
        throw new MikaCliError("BROWSER_LOGIN_FAILED", "Managed browser started, but no reusable browser context was available.");
      }

      return { browser, context };
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  if (lastError && process.env.MIKACLI_VERBOSE_BROWSER_ATTACH === "1") {
    console.error(lastError);
  }

  return null;
}

async function extractBrowserLoginFromProfile(input: {
  platform: Platform;
  startUrl: string;
  profilePath: string;
}): Promise<BrowserLoginCapture> {
  const authCookieNames = getPlatformBrowserAuthCookieNames(input.platform);
  const browserReadyCookieNames = getPlatformBrowserReadyCookieNames(input.platform);
  const authStorageKeys = getPlatformBrowserAuthStorageKeys(input.platform);
  const expectedDomain = getPlatformCookieDomain(input.platform);
  const { chromium } = await import("playwright-core");
  const executablePath = await resolveBrowserExecutable();
  const context = await chromium.launchPersistentContext(input.profilePath, {
    executablePath,
    headless: true,
    args: ["--no-first-run", "--no-default-browser-check"],
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await navigatePage(page, input.startUrl, 10_000);
    await page.waitForTimeout(1_000);

    const cookies = await context.cookies();
    const storage = await readStorage(page);
    if (!hasDetectedAuthenticatedState(cookies, authCookieNames, authStorageKeys, expectedDomain, storage, browserReadyCookieNames)) {
      throw new MikaCliError(
        "BROWSER_LOGIN_FAILED",
        `MikaCLI reopened the saved browser profile, but no authenticated ${getPlatformDisplayName(input.platform)} session was detected after login.`,
        {
          details: {
            platform: input.platform,
            startUrl: input.startUrl,
            browserProfilePath: input.profilePath,
          },
        },
      );
    }

    return {
      cookies,
      finalUrl: page.url(),
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function buildBrowserLoginTimeoutError(input: {
  platform: Platform;
  displayName: string;
  startUrl: string;
  timeoutMs: number;
  browserProfilePath: string;
}): MikaCliError {
  return new MikaCliError(
    "BROWSER_LOGIN_TIMEOUT",
    `Timed out waiting for ${input.displayName} browser login. Complete the sign-in flow within ${Math.round(input.timeoutMs / 1000)} seconds and try again.`,
    {
      details: {
        platform: input.platform,
        startUrl: input.startUrl,
        timeoutSeconds: Math.round(input.timeoutMs / 1000),
        browserProfilePath: input.browserProfilePath,
      },
    },
  );
}

async function requireManagedBrowser(input: {
  announceLabel: string;
  profile?: string;
}): Promise<ManagedBrowserHandle> {
  if (process.versions.bun && process.env.MIKACLI_NODE_BROWSER_REEXEC !== "1") {
    throw new MikaCliError(
      BROWSER_NODE_REEXEC_ERROR_CODE,
      "Shared-browser actions need the Node runtime because Bun cannot reliably attach to Chrome over CDP on this machine.",
    );
  }

  const profile = input.profile ?? DEFAULT_BROWSER_PROFILE;
  const existing = await readManagedBrowserState(profile);
  const reusableExisting = await prepareReusableManagedBrowserState(profile, existing, {
    terminateOnFailure: false,
  });
  if (reusableExisting) {
    announceBrowserLogin(input.announceLabel);
    return {
      state: reusableExisting,
      launchedFresh: false,
    };
  }

  const browserProfilePath = getBrowserProfileDir(profile);
  const discovered = await discoverManagedBrowserState(profile, browserProfilePath);
  const reusableDiscovered = await prepareReusableManagedBrowserState(profile, discovered, {
    terminateOnFailure: false,
  });
  if (reusableDiscovered) {
    announceBrowserLogin(input.announceLabel);
    return {
      state: reusableDiscovered,
      launchedFresh: false,
    };
  }

  throw new MikaCliError(
    "BROWSER_NOT_RUNNING",
    "No usable shared MikaCLI browser profile is running. Start it first with `mikacli login --browser` and keep that browser window open.",
    {
      details: {
        profile,
        browserProfilePath,
      },
    },
  );
}

export function extractManagedBrowserProcessCandidates(
  psOutput: string,
  browserProfilePath: string,
): ManagedBrowserProcessCandidate[] {
  const candidates: ManagedBrowserProcessCandidate[] = [];
  const seen = new Set<string>();

  for (const line of psOutput.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(browserProfilePath) || !trimmed.includes("--remote-debugging-port=")) {
      continue;
    }

    if (trimmed.includes("--type=")) {
      continue;
    }

    const pidMatch = trimmed.match(/^(\d+)\s+/u);
    const portMatch = trimmed.match(/--remote-debugging-port=(\d+)/u);
    if (!pidMatch || !portMatch) {
      continue;
    }

    const pid = Number.parseInt(pidMatch[1] ?? "", 10);
    const port = Number.parseInt(portMatch[1] ?? "", 10);
    if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(port) || port <= 0) {
      continue;
    }

    const command = trimmed.slice(pidMatch[0].length).trim();
    const argsStart = command.indexOf(" --");
    const executablePath = (argsStart === -1 ? command : command.slice(0, argsStart)).trim();
    if (!executablePath) {
      continue;
    }

    const key = `${pid}:${port}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push({
      pid,
      port,
      executablePath,
    });
  }

  return candidates;
}

async function discoverManagedBrowserState(
  profile: string,
  browserProfilePath: string,
): Promise<ManagedBrowserState | null> {
  if (process.platform === "win32") {
    return null;
  }

  try {
    const { stdout } = await execFileAsync("ps", ["-ax", "-o", "pid=", "-o", "command="], {
      maxBuffer: 1024 * 1024,
    });

    const candidates = extractManagedBrowserProcessCandidates(stdout, browserProfilePath);
    for (const candidate of candidates) {
      const state: ManagedBrowserState = {
        pid: candidate.pid,
        port: candidate.port,
        cdpUrl: `http://127.0.0.1:${candidate.port}`,
        browserProfilePath,
        executablePath: candidate.executablePath,
        startedAt: new Date().toISOString(),
      };

      if (!(await isManagedBrowserReachable(state))) {
        continue;
      }

      await writeManagedBrowserState(profile, state);
      return state;
    }
  } catch {
    return null;
  }

  return null;
}

async function prepareReusableManagedBrowserState(
  profile: string,
  state: ManagedBrowserState | null,
  input: {
    terminateOnFailure: boolean;
  },
): Promise<ManagedBrowserState | null> {
  if (!state) {
    return null;
  }

  if (!(await isManagedBrowserReachable(state))) {
    await clearManagedBrowserState(profile);
    return null;
  }

  try {
    await waitForManagedBrowserReady(state, {
      timeoutMs: input.terminateOnFailure ? 5_000 : 3_000,
    });
    await writeManagedBrowserState(profile, state);
    return state;
  } catch {
    await clearManagedBrowserState(profile);
    if (input.terminateOnFailure) {
      await closeManagedBrowser(state).catch(() => {});
      await cleanupStaleAutomatedBrowserProcesses(state.browserProfilePath);
      await cleanupStaleBrowserProfileArtifacts(state.browserProfilePath);
    }
    return null;
  }
}

async function cleanupStaleBrowserProfileArtifacts(browserProfilePath: string): Promise<void> {
  for (const entry of ["SingletonCookie", "SingletonLock", "SingletonSocket", "RunningChromeVersion"]) {
    await unlink(path.join(browserProfilePath, entry)).catch(() => {});
  }
}

async function openOrReusePage(context: BrowserContextLike, startUrl: string, timeoutMs = 15_000): Promise<BrowserPageLike> {
  const page = await getOrCreatePage(context, startUrl);
  await navigatePage(page, startUrl, timeoutMs);
  return page;
}

async function getOrCreatePage(context: BrowserContextLike, startUrl: string): Promise<BrowserPageLike> {
  const existing = context.pages().find((page) => {
    try {
      const url = page.url();
      return url === "about:blank" || url.startsWith(startUrl);
    } catch {
      return false;
    }
  });

  return existing ?? context.newPage();
}

async function navigatePage(page: BrowserPageLike, url: string, timeoutMs = 15_000): Promise<void> {
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
  } catch {
    // Best-effort navigation only. The user can still keep interacting with the browser.
  }
}

async function waitForManagedBrowserReady(
  state: ManagedBrowserState,
  input: {
    timeoutMs?: number;
  } = {},
): Promise<void> {
  const deadline = Date.now() + (input.timeoutMs ?? 15_000);
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    if (!(await isManagedBrowserReachable(state))) {
      await sleep(250);
      continue;
    }

    const connected = await tryConnectToManagedBrowser(state.cdpUrl, Math.min(2_500, Math.max(1_000, deadline - Date.now())));
    if (connected) {
      await connected.browser.close().catch(() => {});
      return;
    }

    lastError = new MikaCliError("BROWSER_LOGIN_FAILED", "The managed browser responded on its debugging port, but Playwright still could not attach.");
    await sleep(250);
  }

  throw new MikaCliError(
    "BROWSER_LOGIN_FAILED",
    "Chrome launched, but MikaCLI could not attach to the shared browser profile in time.",
    {
      details: {
        cdpUrl: state.cdpUrl,
        browserProfilePath: state.browserProfilePath,
        ...(lastError instanceof Error ? { lastError: lastError.message } : {}),
      },
    },
  );
}

async function waitForManagedBrowserCloseOrTimeout(state: ManagedBrowserState, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isManagedBrowserReachable(state))) {
      return true;
    }

    await sleep(500);
  }

  return false;
}

async function isManagedBrowserReachable(state: ManagedBrowserState): Promise<boolean> {
  if (!isProcessAlive(state.pid)) {
    return false;
  }

  const versionInfo = await readManagedBrowserVersionInfo(state.cdpUrl);
  return Boolean(versionInfo);
}

async function readManagedBrowserState(profile: string): Promise<ManagedBrowserState | null> {
  const statePath = getBrowserStatePath(profile);
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ManagedBrowserState>;
    if (
      typeof parsed.pid === "number" &&
      typeof parsed.port === "number" &&
      typeof parsed.cdpUrl === "string" &&
      typeof parsed.browserProfilePath === "string" &&
      typeof parsed.executablePath === "string" &&
      typeof parsed.startedAt === "string"
    ) {
      return parsed as ManagedBrowserState;
    }
  } catch {
    return null;
  }

  return null;
}

async function clearManagedBrowserState(profile: string): Promise<void> {
  await unlink(getBrowserStatePath(profile)).catch(() => {});
}

async function writeManagedBrowserState(profile: string, state: ManagedBrowserState): Promise<void> {
  const statePath = getBrowserStatePath(profile);
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function closeManagedBrowser(state: ManagedBrowserState): Promise<void> {
  if (isProcessAlive(state.pid)) {
    try {
      process.kill(state.pid, "SIGTERM");
      await sleep(500);
      if (isProcessAlive(state.pid)) {
        process.kill(state.pid, "SIGKILL");
      }
    } catch {
      // Best effort only.
    }
  }

  const statePath = path.join(state.browserProfilePath, "state.json");
  await unlink(statePath).catch(() => {});
}

async function readManagedBrowserVersionInfo(cdpUrl: string): Promise<ManagedBrowserVersionInfo | null> {
  try {
    const response = await fetch(`${cdpUrl}/json/version`);
    if (!response.ok) {
      return null;
    }

    const parsed = await response.json().catch(() => null) as unknown;
    const info = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
    if (!info) {
      return null;
    }

    return {
      browser: typeof info.Browser === "string" ? info.Browser : undefined,
      userAgent: typeof info["User-Agent"] === "string" ? info["User-Agent"] : undefined,
      webSocketDebuggerUrl: typeof info.webSocketDebuggerUrl === "string" ? info.webSocketDebuggerUrl : undefined,
    };
  } catch {
    return null;
  }
}

export function resolveManagedBrowserConnectEndpoint(
  cdpUrl: string,
  versionInfo?: ManagedBrowserVersionInfo | null,
): string {
  const wsUrl = versionInfo?.webSocketDebuggerUrl?.trim();
  if (wsUrl && /^wss?:\/\//u.test(wsUrl)) {
    return wsUrl;
  }

  return cdpUrl;
}

async function cleanupStaleAutomatedBrowserProcesses(browserProfilePath: string): Promise<void> {
  if (process.platform === "win32") {
    return;
  }

  try {
    const { stdout } = await execFileAsync("ps", ["-ax", "-o", "pid=", "-o", "command="], {
      maxBuffer: 1024 * 1024,
    });

    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(browserProfilePath)) {
        continue;
      }

      if (
        !trimmed.includes("--enable-automation") &&
        !trimmed.includes("--remote-debugging-pipe") &&
        !trimmed.includes("--remote-debugging-port=")
      ) {
        continue;
      }

      const match = trimmed.match(/^(\d+)\s+/u);
      if (!match) {
        continue;
      }

      const pid = Number.parseInt(match[1] ?? "", 10);
      if (!Number.isFinite(pid) || pid <= 0) {
        continue;
      }

      try {
        process.kill(pid, "SIGTERM");
        await sleep(300);
        if (isProcessAlive(pid)) {
          process.kill(pid, "SIGKILL");
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Best-effort cleanup only.
  }
}

export async function probeBrowserExecutable(): Promise<BrowserExecutableProbe> {
  const override = process.env.MIKACLI_BROWSER_PATH?.trim();
  if (override) {
    try {
      await access(override, constants.X_OK);
      return {
        available: true,
        path: override,
        source: "env",
      };
    } catch {
      return {
        available: false,
        path: override,
        source: "env",
        error: `MIKACLI_BROWSER_PATH points to a browser that is not executable: ${override}`,
      };
    }
  }

  const candidates = process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      ]
    : process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          path.join(process.env.LOCALAPPDATA ?? "", "Google\\Chrome\\Application\\chrome.exe"),
          path.join(process.env.PROGRAMFILES ?? "", "Chromium\\Application\\chrome.exe"),
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
          "/snap/bin/chromium",
        ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      await access(candidate, constants.X_OK);
      return {
        available: true,
        path: candidate,
        source: "system",
      };
    } catch {
      continue;
    }
  }

  return {
    available: false,
    source: "system",
    candidates,
    error: "Could not find a Chrome or Chromium executable. Install Chrome/Chromium or set MIKACLI_BROWSER_PATH to the browser binary.",
  };
}

async function resolveBrowserExecutable(): Promise<string> {
  const probe = await probeBrowserExecutable();
  if (probe.available && probe.path) {
    return probe.path;
  }

  throw new MikaCliError("BROWSER_NOT_FOUND", probe.error ?? "Could not find a Chrome or Chromium executable.");
}

async function readStorage(page: BrowserPageLike): Promise<{ localStorage: Record<string, string>; sessionStorage: Record<string, string> }> {
  try {
    return await page.evaluate(() => {
      const localStorageEntries: Record<string, string> = {};
      const sessionStorageEntries: Record<string, string> = {};

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        const value = window.localStorage.getItem(key);
        if (value !== null) {
          localStorageEntries[key] = value;
        }
      }

      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        if (!key) continue;
        const value = window.sessionStorage.getItem(key);
        if (value !== null) {
          sessionStorageEntries[key] = value;
        }
      }

      return {
        localStorage: localStorageEntries,
        sessionStorage: sessionStorageEntries,
      };
    });
  } catch {
    return {
      localStorage: {},
      sessionStorage: {},
    };
  }
}

function attachNetworkCapture(
  page: PlaywrightPage,
  input: {
    filterDomain?: string;
    filterText?: string;
  },
): CapturedBrowserRequest[] {
  const requests: CapturedBrowserRequest[] = [];
  const requestMap = new Map<PlaywrightRequest, CapturedBrowserRequest>();

  const matchesRequest = (url: string): boolean => {
    if (input.filterDomain) {
      try {
        const hostname = new URL(url).hostname.replace(/^\./u, "");
        const normalizedDomain = input.filterDomain.replace(/^\./u, "");
        if (hostname !== normalizedDomain && !hostname.endsWith(`.${normalizedDomain}`)) {
          return false;
        }
      } catch {
        return false;
      }
    }

    if (input.filterText) {
      return url.includes(input.filterText);
    }

    return true;
  };

  page.on("request", (request) => {
    if (!matchesRequest(request.url())) {
      return;
    }

    const entry: CapturedBrowserRequest = {
      id: requests.length + 1,
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      requestHeaders: request.headers(),
    };

    const postData = request.postData();
    if (typeof postData === "string" && postData.length > 0) {
      entry.postData = postData.slice(0, 2_000);
    }

    requests.push(entry);
    requestMap.set(request, entry);
  });

  page.on("response", async (response: PlaywrightResponse) => {
    const entry = requestMap.get(response.request());
    if (!entry) {
      return;
    }

    entry.status = response.status();
    entry.statusText = response.statusText();
    entry.responseHeaders = await response.allHeaders().catch(() => ({}));
  });

  page.on("requestfailed", (request: PlaywrightRequest) => {
    const entry = requestMap.get(request);
    if (!entry) {
      return;
    }

    entry.failureText = request.failure()?.errorText;
  });

  return requests;
}

function isStrongBrowserAuthCookie(cookie: unknown, pattern: string): boolean {
  if (!cookie || typeof cookie !== "object") {
    return false;
  }

  const name = "name" in cookie && typeof cookie.name === "string" ? cookie.name : null;
  const value = "value" in cookie && typeof cookie.value === "string" ? cookie.value : "";
  if (!name || !matchesCookiePattern(name, pattern)) {
    return false;
  }

  if (WEAK_BROWSER_AUTH_COOKIE_NAMES.has(name)) {
    return false;
  }

  if (BOOLEAN_BROWSER_AUTH_COOKIE_NAMES.has(name)) {
    return !FALSEY_AUTH_COOKIE_VALUES.has(value.trim().toLowerCase());
  }

  return value.trim().length > 0;
}

function hasPresentBrowserCookie(cookie: unknown, pattern: string): boolean {
  if (!cookie || typeof cookie !== "object") {
    return false;
  }

  const name = "name" in cookie && typeof cookie.name === "string" ? cookie.name : null;
  const value = "value" in cookie && typeof cookie.value === "string" ? cookie.value : "";
  if (!name || !matchesCookiePattern(name, pattern)) {
    return false;
  }

  return value.trim().length > 0;
}

function matchesCookiePattern(name: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }

  return name === pattern;
}

function hasTruthyStorageValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && !FALSEY_AUTH_COOKIE_VALUES.has(value.trim().toLowerCase());
}

async function applyBrowserContextCookies(
  context: PlaywrightBrowserContext,
  cookies: unknown[],
  input: {
    targetUrl?: string;
  } = {},
): Promise<void> {
  const normalized = cookies
    .map((cookie) => normalizePlaywrightCookie(cookie, input))
    .filter((cookie): cookie is NonNullable<typeof cookie> => Boolean(cookie));

  if (normalized.length === 0) {
    return;
  }

  await context.addCookies(normalized);
}

export function normalizePlaywrightCookie(
  cookie: unknown,
  input: {
    targetUrl?: string;
  } = {},
):
  | {
      name: string;
      value: string;
      domain: string;
      path: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
      expires?: number;
    }
  | null {
  if (!cookie || typeof cookie !== "object") {
    return null;
  }

  const value = cookie as Record<string, unknown>;
  const name = typeof value.name === "string"
    ? value.name
    : typeof value.key === "string"
      ? value.key
      : undefined;
  const cookieValue = typeof value.value === "string" ? value.value : undefined;
  const rawDomain = typeof value.domain === "string" && value.domain.length > 0 ? value.domain : undefined;
  const domain = normalizePlaywrightCookieDomain(rawDomain, input.targetUrl);
  if (!name || cookieValue === undefined || !domain) {
    return null;
  }

  const pathValue = typeof value.path === "string" && value.path.length > 0 ? value.path : "/";
  const secure = typeof value.secure === "boolean" ? value.secure : undefined;
  const httpOnly = typeof value.httpOnly === "boolean" ? value.httpOnly : undefined;
  const sameSite = normalizePlaywrightSameSite(value.sameSite);
  const expires = normalizePlaywrightCookieExpiry(value.expires);

  return {
    name,
    value: cookieValue,
    domain,
    path: pathValue,
    ...(typeof secure === "boolean" ? { secure } : {}),
    ...(typeof httpOnly === "boolean" ? { httpOnly } : {}),
    ...(sameSite ? { sameSite } : {}),
    ...(typeof expires === "number" ? { expires } : {}),
  };
}

function normalizePlaywrightCookieDomain(domain: string | undefined, targetUrl?: string): string | undefined {
  if (!domain) {
    return undefined;
  }

  if (domain.startsWith(".")) {
    return domain;
  }

  if (!targetUrl) {
    return domain;
  }

  let targetHost = "";
  try {
    targetHost = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return domain;
  }

  const cookieHost = domain.toLowerCase();
  if (targetHost === cookieHost) {
    return domain;
  }

  if (targetHost.endsWith(`.${cookieHost}`)) {
    return `.${domain}`;
  }

  return domain;
}

function normalizePlaywrightSameSite(value: unknown): "Strict" | "Lax" | "None" | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  switch (value.toLowerCase()) {
    case "strict":
      return "Strict";
    case "lax":
      return "Lax";
    case "none":
      return "None";
    default:
      return undefined;
  }
}

function normalizePlaywrightCookieExpiry(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Math.floor(value.getTime() / 1000);
  }

  return undefined;
}

function announceBrowserLogin(message: string): void {
  if (process.argv.includes("--json")) {
    return;
  }

  if (emitInteractiveProgress(message)) {
    return;
  }

  console.log(message);
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a browser debugging port.")));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
