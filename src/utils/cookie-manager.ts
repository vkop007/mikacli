import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { extname } from "node:path";

import { Cookie, CookieJar, type SerializedCookieJar } from "tough-cookie";
import { z } from "zod";

import {
  DEFAULT_ACCOUNT_NAME,
  SESSION_FILE_VERSION,
  ensureParentDirectory,
  ensureSessionDirectory,
  getPlatformSessionDir,
  SESSIONS_DIR,
  getSessionPath,
  sanitizeAccountName,
} from "../config.js";
import { MikaCliError } from "../errors.js";
import { getPlatformCookieDomain, getPlatformHomeUrl, isPlatform, PLATFORM_NAMES } from "../platforms/config.js";
import { captureBrowserLogin, type BrowserLoginCapture } from "./browser-cookie-login.js";
import type { Platform, PlatformSession, SessionSource } from "../types.js";

const BrowserCookieSchema = z.object({
  name: z.string().optional(),
  key: z.string().optional(),
  value: z.string(),
  domain: z.string().optional(),
  hostOnly: z.boolean().optional(),
  path: z.string().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  expirationDate: z.number().optional(),
  expires: z.union([z.string(), z.number(), z.null()]).optional(),
  session: z.boolean().optional(),
  sameSite: z.string().nullable().optional(),
});

const SessionFileSchema = z.object({
  version: z.literal(1),
  platform: z.enum(PLATFORM_NAMES),
  account: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  source: z.object({
    kind: z.enum(["cookies_txt", "cookie_string", "cookie_json"]),
    importedAt: z.string(),
    description: z.string(),
    path: z.string().optional(),
  }),
  user: z
    .object({
      id: z.string().optional(),
      username: z.string().optional(),
      displayName: z.string().optional(),
      profileUrl: z.string().optional(),
    })
    .optional(),
  status: z.object({
    state: z.enum(["active", "expired", "unknown"]),
    message: z.string().optional(),
    lastValidatedAt: z.string().optional(),
    lastErrorCode: z.string().optional(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  cookieJar: z.custom<SerializedCookieJar>(),
});

interface ImportedCookies {
  jar: CookieJar;
  source: SessionSource;
  browserState?: BrowserLoginCapture;
}

export class CookieManager {
  async importCookies(
    platform: Platform,
    input: {
      account?: string;
      cookieFile?: string;
      cookieString?: string;
      cookieJson?: string;
      browser?: boolean;
      browserTimeoutSeconds?: number;
      browserUrl?: string;
    },
  ): Promise<ImportedCookies> {
    const providedInputs = [
      input.cookieFile ? "cookieFile" : null,
      input.cookieString ? "cookieString" : null,
      input.cookieJson ? "cookieJson" : null,
      input.browser ? "browser" : null,
    ].filter(Boolean);

    if (providedInputs.length !== 1) {
      throw new MikaCliError(
        "INVALID_LOGIN_INPUT",
        "Provide exactly one of --cookies, --cookie-string, --cookie-json, or --browser.",
        {
          details: {
            providedInputs,
          },
        },
      );
    }

    if (input.cookieFile) {
      const content = await readInputFile(input.cookieFile);
      const jar = await this.parseAnyCookieInput(platform, content);
      return {
        jar,
        source: {
          kind: extname(input.cookieFile).toLowerCase() === ".txt" ? "cookies_txt" : "cookie_json",
          importedAt: new Date().toISOString(),
          description: `Imported from ${input.cookieFile}`,
          path: input.cookieFile,
        },
      };
    }

    if (input.cookieString) {
      return {
        jar: await this.parseCookieString(platform, input.cookieString),
        source: {
          kind: "cookie_string",
          importedAt: new Date().toISOString(),
          description: "Imported from raw cookie string",
        },
      };
    }

    if (input.browser) {
      const reused = await this.tryReuseActiveSession(platform, input.account);
      if (reused) {
        return reused;
      }

      const browserState = await captureBrowserLogin(platform, {
        browserUrl: input.browserUrl,
        timeoutSeconds: input.browserTimeoutSeconds,
      });

      return {
        jar: await this.parseCookieJson(platform, JSON.stringify(browserState.cookies)),
        source: {
          kind: "cookie_json",
          importedAt: new Date().toISOString(),
          description: `Imported from interactive browser login for ${platform}`,
        },
        browserState,
      };
    }

    return {
      jar: await this.parseCookieJson(platform, input.cookieJson ?? ""),
      source: {
        kind: "cookie_json",
        importedAt: new Date().toISOString(),
        description: "Imported from cookie JSON",
      },
    };
  }

  async saveSession(session: PlatformSession): Promise<string> {
    const sessionPath = getSessionPath(session.platform, session.account);
    await ensureParentDirectory(sessionPath);
    await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
    return sessionPath;
  }

  async loadSession(platform: Platform, account?: string): Promise<{ session: PlatformSession; path: string }> {
    const resolvedAccount = account ? sanitizeAccountName(account) : await this.resolveDefaultAccount(platform);
    const sessionPath = getSessionPath(platform, resolvedAccount);

    await access(sessionPath, constants.R_OK).catch(() => {
      throw new MikaCliError(
        "SESSION_NOT_FOUND",
        `No saved ${platform} session found for account "${resolvedAccount}".`,
        {
          details: { platform, account: resolvedAccount, sessionPath },
        },
      );
    });

    const raw = await readFile(sessionPath, "utf8");
    const parsed = this.parseSessionFile(raw, sessionPath);
    return { session: parsed, path: sessionPath };
  }

  async listSessions(): Promise<Array<{ session: PlatformSession; path: string }>> {
    await ensureSessionDirectory();
    const platforms = await readdir(SESSIONS_DIR, { withFileTypes: true }).catch(() => []);

    const results: Array<{ session: PlatformSession; path: string }> = [];

    for (const entry of platforms) {
      if (!entry.isDirectory()) {
        continue;
      }

      const platform = entry.name;
      if (!isPlatform(platform)) {
        continue;
      }

      results.push(...(await this.listPlatformSessions(platform)));
    }

    return results.sort((left, right) => {
      if (left.session.platform !== right.session.platform) {
        return left.session.platform.localeCompare(right.session.platform);
      }

      return right.session.updatedAt.localeCompare(left.session.updatedAt);
    });
  }

  async createJar(session: PlatformSession): Promise<CookieJar> {
    return CookieJar.deserialize(session.cookieJar);
  }

  async parseAnyCookieInput(platform: Platform, content: string): Promise<CookieJar> {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return this.parseCookieJson(platform, trimmed);
    }

    if (looksLikeNetscapeCookies(content)) {
      return this.parseNetscapeCookies(platform, content);
    }

    return this.parseCookieString(platform, content);
  }

  async parseCookieJson(platform: Platform, input: string): Promise<CookieJar> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(input);
    } catch (error) {
      throw new MikaCliError("INVALID_COOKIE_JSON", "Failed to parse cookie JSON.", {
        cause: error,
      });
    }

    if (isSerializedJar(parsed)) {
      return CookieJar.deserialize(parsed);
    }

    const rawCookies = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed && "cookies" in parsed && Array.isArray((parsed as { cookies?: unknown }).cookies)
        ? (parsed as { cookies: unknown[] }).cookies
        : null;

    if (!rawCookies) {
      throw new MikaCliError(
        "INVALID_COOKIE_JSON",
        "Cookie JSON must be a cookie jar export or an array of cookie objects.",
      );
    }

    return createCookieJarFromBrowserCookies(rawCookies, defaultCookieDomain(platform));
  }

  async parseCookieString(platform: Platform, input: string): Promise<CookieJar> {
    const jar = new CookieJar();
    const pairs = input
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    if (pairs.length === 0) {
      throw new MikaCliError("INVALID_COOKIE_STRING", "Cookie string is empty.");
    }

    for (const pair of pairs) {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex < 1) {
        continue;
      }

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      const cookie = new Cookie({
        key: name,
        value,
        domain: defaultCookieDomain(platform),
        path: "/",
        secure: true,
      });
      await setCookieOnJar(jar, cookie);
    }

    return jar;
  }

  async parseNetscapeCookies(platform: Platform, input: string): Promise<CookieJar> {
    const jar = new CookieJar();

    for (const line of input.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const parts = line.split("\t");
      if (parts.length < 7) {
        continue;
      }

      const [domainRaw, includeSubdomainsRaw, pathRaw, secureFlagRaw, expiresRaw, nameRaw, ...valueParts] = parts;
      const domain = normalizeCookieDomain(domainRaw ?? defaultCookieDomain(platform));
      const path = pathRaw || "/";
      const secureFlag = secureFlagRaw ?? "FALSE";
      const name = nameRaw ?? "";
      if (!name) {
        continue;
      }

      const cookie = new Cookie({
        key: name,
        value: valueParts.join("\t"),
        domain,
        hostOnly: String(includeSubdomainsRaw ?? "").toUpperCase() !== "TRUE",
        path,
        secure: secureFlag.toUpperCase() === "TRUE",
        expires: parseCookieExpiry(expiresRaw ?? ""),
      });
      await setCookieOnJar(jar, cookie);
    }

    const cookies = await jar.getCookies(platformOrigin(platform));
    if (cookies.length === 0 && !jarContainsPlatformDomainCookies(jar, platform)) {
      throw new MikaCliError("INVALID_COOKIE_FILE", "No usable cookies were found in the cookies.txt file.");
    }

    return jar;
  }

  private async resolveDefaultAccount(platform: Platform): Promise<string> {
    const sessions = await this.listPlatformSessions(platform);
    const latest = sessions[0];

    if (!latest) {
      return DEFAULT_ACCOUNT_NAME;
    }

    return latest.session.account;
  }

  private async listPlatformSessions(platform: Platform): Promise<Array<{ session: PlatformSession; path: string }>> {
    await ensureSessionDirectory(platform);
    const platformDir = getPlatformSessionDir(platform);
    const files = await readdir(platformDir, { withFileTypes: true }).catch(() => []);
    const sessions: Array<{ session: PlatformSession; path: string }> = [];

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) {
        continue;
      }

      const path = `${platformDir}/${file.name}`;
      try {
        const raw = await readFile(path, "utf8");
        const parsed = this.parseSessionFile(raw, path);
        sessions.push({ session: parsed, path });
      } catch (error) {
        if (error instanceof MikaCliError && error.code === "SESSION_INVALID") {
          continue;
        }
        throw error;
      }
    }

    return sessions.sort((left, right) => right.session.updatedAt.localeCompare(left.session.updatedAt));
  }

  private parseSessionFile(raw: string, path: string): PlatformSession {
    try {
      return SessionFileSchema.parse(JSON.parse(raw)) as PlatformSession;
    } catch (error) {
      throw new MikaCliError(
        "SESSION_INVALID",
        `Saved session file is corrupted: ${path}. Re-import cookies or remove the broken session file.`,
        {
          cause: error,
          details: {
            path,
            message: error instanceof Error ? error.message : String(error),
          },
        },
      );
    }
  }

  private async tryReuseActiveSession(platform: Platform, account?: string): Promise<ImportedCookies | null> {
    try {
      const { session } = await this.loadSession(platform, account);
      if (session.status.state !== "active") {
        return null;
      }

      return {
        jar: await this.createJar(session),
        source: session.source,
      };
    } catch {
      return null;
    }
  }
}

export function createSessionFile(input: {
  platform: Platform;
  account: string;
  source: SessionSource;
  user?: PlatformSession["user"];
  status?: PlatformSession["status"];
  metadata?: Record<string, unknown>;
  cookieJar: SerializedCookieJar;
  existingSession?: PlatformSession;
}): PlatformSession {
  const now = new Date().toISOString();
  const session: PlatformSession = {
    version: SESSION_FILE_VERSION,
    platform: input.platform,
    account: sanitizeAccountName(input.account),
    createdAt: input.existingSession?.createdAt ?? now,
    updatedAt: now,
    source: input.source,
    status: input.status ?? { state: "unknown" },
    cookieJar: input.cookieJar,
  };

  if (input.user) {
    session.user = input.user;
  }

  if (input.metadata) {
    session.metadata = input.metadata;
  }

  return session;
}

export function serializeCookieJar(jar: CookieJar): SerializedCookieJar {
  const serialized = jar.toJSON();
  if (!serialized) {
    throw new MikaCliError("COOKIE_SERIALIZATION_FAILED", "Failed to serialize the cookie jar.");
  }

  return serialized;
}

export async function createCookieJarFromBrowserCookies(cookies: unknown[], fallbackDomain: string): Promise<CookieJar> {
  const jar = new CookieJar();

  for (const rawCookie of cookies) {
    const parsedCookie = BrowserCookieSchema.safeParse(rawCookie);
    if (!parsedCookie.success) {
      throw new MikaCliError(
        "INVALID_COOKIE_JSON",
        "Cookie JSON contains an unsupported cookie object.",
        {
          details: {
            issues: parsedCookie.error.issues,
          },
          cause: parsedCookie.error,
        },
      );
    }

    const cookie = parsedCookie.data;
    await setCookieOnJar(jar, createCookieFromLooseObject(cookie, fallbackDomain));
  }

  return jar;
}

function platformOrigin(platform: Platform): string {
  return getPlatformHomeUrl(platform);
}

function defaultCookieDomain(platform: Platform): string {
  return getPlatformCookieDomain(platform);
}

function jarContainsPlatformDomainCookies(jar: CookieJar, platform: Platform): boolean {
  const serialized = jar.toJSON();
  if (!serialized || !Array.isArray(serialized.cookies)) {
    return false;
  }
  const platformDomain = defaultCookieDomain(platform);
  return serialized.cookies.some((cookie) => {
    const domain = typeof cookie.domain === "string" ? normalizeCookieDomain(cookie.domain) : "";
    return domain === platformDomain || domain.endsWith(`.${platformDomain}`) || domain.endsWith(platformDomain);
  });
}

function looksLikeNetscapeCookies(content: string): boolean {
  return content.includes("# Netscape HTTP Cookie File") || /\t(TRUE|FALSE)\t/u.test(content);
}

function parseCookieExpiry(raw: string): Date | "Infinity" {
  if (!raw || raw === "0") {
    return "Infinity";
  }

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber > 0) {
    return new Date(asNumber * 1_000);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "Infinity" : parsed;
}

async function readInputFile(path: string): Promise<string> {
  await access(path, constants.R_OK).catch(() => {
    throw new MikaCliError("COOKIE_FILE_NOT_FOUND", `Cookie file not found or unreadable: ${path}`, {
      details: { path },
    });
  });

  return readFile(path, "utf8");
}

async function setCookieOnJar(jar: CookieJar, cookie: Cookie): Promise<void> {
  const domain = normalizeCookieDomain(cookie.domain ?? "localhost");
  cookie.domain = domain;
  await jar.setCookie(cookie, `https://${domain}${cookie.path || "/"}`, {
    ignoreError: true,
  });
}

function createCookieFromLooseObject(
  cookie: z.infer<typeof BrowserCookieSchema>,
  fallbackDomain: string,
): Cookie {
  const expiresRaw = cookie.expirationDate ?? cookie.expires;
  const rawDomain = cookie.domain ?? fallbackDomain;
  const normalizedDomain = normalizeCookieDomain(rawDomain);
  const hostOnly = cookie.hostOnly ?? !rawDomain.startsWith(".");
  return new Cookie({
    key: cookie.name ?? cookie.key ?? "cookie",
    value: cookie.value,
    domain: normalizedDomain,
    hostOnly,
    path: cookie.path ?? "/",
    secure: cookie.secure ?? true,
    httpOnly: cookie.httpOnly ?? false,
    sameSite: normalizeSameSite(cookie.sameSite ?? undefined),
    expires:
      cookie.session === true || expiresRaw === undefined ? "Infinity" : parseCookieExpiry(String(expiresRaw)),
  });
}

function normalizeSameSite(input?: string): "strict" | "lax" | "none" | undefined {
  if (!input) {
    return undefined;
  }

  const normalized = input.toLowerCase();
  if (normalized === "strict" || normalized === "lax" || normalized === "none") {
    return normalized;
  }

  return undefined;
}

function isSerializedJar(value: unknown): value is SerializedCookieJar {
  return typeof value === "object" && value !== null && "cookies" in value && "version" in value;
}

function normalizeCookieDomain(domain: string): string {
  return domain.replace(/^\./u, "");
}
