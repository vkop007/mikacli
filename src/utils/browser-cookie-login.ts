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

export interface BrowserLoginCapture {
  cookies: unknown[];
  finalUrl: string;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
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
  browser: {
    contexts(): Array<BrowserContextLike>;
    close(): Promise<void>;
  };
  context: BrowserContextLike;
};

type BrowserContextLike = {
  pages(): BrowserPageLike[];
  newPage(): Promise<BrowserPageLike>;
  cookies(): Promise<unknown[]>;
};

type BrowserPageLike = {
  url(): string;
  goto(url: string, options?: unknown): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
};

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
    const page = await openOrReusePage(connected.context, startUrl);

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
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => {});
    throw new AutoCliError("BROWSER_LOGIN_FAILED", "Managed browser started, but no reusable browser context was available.");
  }

  return { browser, context };
}

async function openOrReusePage(context: BrowserContextLike, startUrl: string): Promise<BrowserPageLike> {
  const existing = context.pages().find((page) => {
    try {
      const url = page.url();
      return url === "about:blank" || url.startsWith(startUrl);
    } catch {
      return false;
    }
  });

  const page = existing ?? (await context.newPage());
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  return page;
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
