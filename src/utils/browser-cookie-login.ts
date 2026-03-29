import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { AutoCliError } from "../errors.js";
import {
  DEFAULT_BROWSER_PROFILE,
  ensureBrowserDirectory,
  getBrowserProfileDir,
  getBrowserStatePath,
} from "../config.js";
import {
  getPlatformBrowserAuthCookieNames,
  getPlatformBrowserAuthStorageKeys,
  getPlatformCookieDomain,
  getPlatformDisplayName,
  getPlatformHomeUrl,
} from "../platforms/config.js";
import type { Platform } from "../types.js";
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

export interface SharedBrowserActionInput<T> {
  targetUrl: string;
  timeoutSeconds?: number;
  announceLabel?: string;
  action: (page: PlaywrightPage) => Promise<T>;
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

const execFileAsync = promisify(execFile);

type ConnectedBrowser = {
  browser: PlaywrightBrowser;
  context: PlaywrightBrowserContext;
};

type BrowserContextLike = PlaywrightBrowserContext;
type BrowserPageLike = PlaywrightPage;

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
  const authStorageKeys = getPlatformBrowserAuthStorageKeys(platform);
  const expectedDomain = getPlatformCookieDomain(platform);

  const managed = await ensureManagedBrowser({
    browserUrl: startUrl,
    announceLabel: `Opening shared AutoCLI browser profile for ${displayName} login: ${startUrl}`,
  });

  let connected: ConnectedBrowser | null = null;
  try {
    connected = await connectToManagedBrowser(managed.state.cdpUrl);
    const page = await openOrReusePage(connected.context, startUrl, Math.min(timeoutMs, 15_000));

    announceBrowserLogin("Complete the sign-in flow in the opened browser window. AutoCLI will save the extracted session automatically once login is detected.");

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cookies = await connected.context.cookies();
      const storage = await readStorage(page);
      if (hasDetectedAuthenticatedState(cookies, authCookieNames, authStorageKeys, expectedDomain, storage)) {
        return {
          cookies,
          finalUrl: page.url(),
          localStorage: storage.localStorage,
          sessionStorage: storage.sessionStorage,
        };
      }

      await page.waitForTimeout(1000);
    }

    throw new AutoCliError(
      "BROWSER_LOGIN_TIMEOUT",
      `Timed out waiting for ${displayName} browser login. Complete the sign-in flow within ${Math.round(timeoutMs / 1000)} seconds and try again.`,
      {
        details: {
          platform,
          startUrl,
          timeoutSeconds: Math.round(timeoutMs / 1000),
          browserProfilePath: managed.state.browserProfilePath,
        },
      },
    );
  } catch (error) {
    if (error instanceof AutoCliError) {
      throw error;
    }

    throw new AutoCliError(
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
}> {
  const startUrl = input.browserUrl?.trim() || "https://accounts.google.com/";
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 600) * 1000;

  const managed = await ensureManagedBrowser({
    browserUrl: startUrl,
    announceLabel: `Opening shared AutoCLI browser profile: ${startUrl}`,
  });

  announceBrowserLogin("Sign into Google or any other identity provider you want AutoCLI to reuse later. Close the browser window when you are done.");

  const finished = await waitForManagedBrowserCloseOrTimeout(managed.state, timeoutMs);
  return {
    browserProfilePath: managed.state.browserProfilePath,
    startUrl,
    timedOut: !finished,
  };
}

export async function inspectSharedBrowserTarget(input: {
  targetUrl: string;
  timeoutSeconds?: number;
}): Promise<BrowserTargetInspection> {
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 60) * 1000;
  const managed = await requireManagedBrowser({
    announceLabel: `Attaching to the shared AutoCLI browser profile for inspection: ${input.targetUrl}`,
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
    announceLabel: `Attaching to the shared AutoCLI browser profile for capture: ${input.targetUrl}`,
  });

  let connected: ConnectedBrowser | null = null;
  try {
    connected = await connectToManagedBrowser(managed.state.cdpUrl);
    const page = await getOrCreatePage(connected.context, input.targetUrl);
    const requests = attachNetworkCapture(page, {
      filterDomain: input.filterDomain,
      filterText: input.filterText,
    });

    announceBrowserLogin("Interact in the opened browser window. AutoCLI is capturing network requests now.");
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
    announceLabel: input.announceLabel ?? `Opening shared AutoCLI browser profile: ${input.targetUrl}`,
  });

  let connected: ConnectedBrowser | null = null;
  try {
    connected = await connectToManagedBrowser(managed.state.cdpUrl);
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

export function hasDetectedAuthenticatedState(
  cookies: unknown[],
  authCookieNames: readonly string[],
  authStorageKeys: readonly string[],
  expectedDomain: string,
  storage: { localStorage: Record<string, string>; sessionStorage: Record<string, string> },
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
    return true;
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

async function ensureManagedBrowser(input: {
  browserUrl: string;
  announceLabel: string;
  profile?: string;
}): Promise<ManagedBrowserHandle> {
  const profile = input.profile ?? DEFAULT_BROWSER_PROFILE;
  await ensureBrowserDirectory(profile);
  const browserProfilePath = getBrowserProfileDir(profile);

  const existing = await readManagedBrowserState(profile);
  if (existing && await isManagedBrowserReachable(existing)) {
    announceBrowserLogin(input.announceLabel);
    return {
      state: existing,
      launchedFresh: false,
    };
  }

  await cleanupStaleAutomatedBrowserProcesses(browserProfilePath);

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

  await waitForManagedBrowserReady(state);
  await writeManagedBrowserState(profile, state);
  announceBrowserLogin(input.announceLabel);
  return {
    state,
    launchedFresh: true,
  };
}

async function connectToManagedBrowser(cdpUrl: string): Promise<ConnectedBrowser> {
  const { chromium } = await import("playwright-core");

  const deadline = Date.now() + 15_000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl, {
        timeout: 3_000,
      });
      const context = browser.contexts()[0];
      if (!context) {
        await browser.close().catch(() => {});
        throw new AutoCliError("BROWSER_LOGIN_FAILED", "Managed browser started, but no reusable browser context was available.");
      }

      return { browser, context };
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  throw new AutoCliError("BROWSER_LOGIN_FAILED", "Managed browser started, but AutoCLI could not attach over CDP in time.", {
    cause: lastError,
    details: {
      cdpUrl,
    },
  });
}

async function requireManagedBrowser(input: {
  announceLabel: string;
  profile?: string;
}): Promise<ManagedBrowserHandle> {
  const profile = input.profile ?? DEFAULT_BROWSER_PROFILE;
  const existing = await readManagedBrowserState(profile);
  if (!existing || !(await isManagedBrowserReachable(existing))) {
    throw new AutoCliError(
      "BROWSER_NOT_RUNNING",
      "No shared AutoCLI browser profile is running. Start it first with `autocli login --browser` and keep that browser window open.",
      {
        details: {
          profile,
          browserProfilePath: getBrowserProfileDir(profile),
        },
      },
    );
  }

  announceBrowserLogin(input.announceLabel);
  return {
    state: existing,
    launchedFresh: false,
  };
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

async function waitForManagedBrowserReady(state: ManagedBrowserState): Promise<void> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (!(await isManagedBrowserReachable(state))) {
      await sleep(250);
      continue;
    }

    return;
  }

  throw new AutoCliError(
    "BROWSER_LOGIN_FAILED",
    "Chrome launched, but AutoCLI could not connect to the shared browser profile in time.",
    {
      details: {
        cdpUrl: state.cdpUrl,
        browserProfilePath: state.browserProfilePath,
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

  try {
    const response = await fetch(`${state.cdpUrl}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
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

  const statePath = getBrowserStatePath();
  await unlink(statePath).catch(() => {});
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

      if (!trimmed.includes("--enable-automation") && !trimmed.includes("--remote-debugging-pipe")) {
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

async function resolveBrowserExecutable(): Promise<string> {
  const override = process.env.AUTOCLI_BROWSER_PATH?.trim();
  if (override) {
    await access(override, constants.X_OK).catch(() => {
      throw new AutoCliError("BROWSER_NOT_FOUND", `AUTOCLI_BROWSER_PATH points to a browser that is not executable: ${override}`);
    });
    return override;
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
      return candidate;
    } catch {
      continue;
    }
  }

  throw new AutoCliError(
    "BROWSER_NOT_FOUND",
    "Could not find a Chrome or Chromium executable. Install Chrome/Chromium or set AUTOCLI_BROWSER_PATH to the browser binary.",
  );
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

function matchesCookiePattern(name: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }

  return name === pattern;
}

function hasTruthyStorageValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && !FALSEY_AUTH_COOKIE_VALUES.has(value.trim().toLowerCase());
}

function announceBrowserLogin(message: string): void {
  if (process.argv.includes("--json")) {
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
