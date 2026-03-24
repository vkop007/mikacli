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
import { AutoCliError } from "../errors.js";
import type { Platform, PlatformSession, SessionSource } from "../types.js";

const BrowserCookieSchema = z.object({
  name: z.string().optional(),
  key: z.string().optional(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  expirationDate: z.number().optional(),
  expires: z.union([z.string(), z.number(), z.null()]).optional(),
  sameSite: z.string().nullable().optional(),
});

const SessionFileSchema = z.object({
  version: z.literal(1),
  platform: z.enum(["instagram", "linkedin", "x", "youtube"]),
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
}

export class CookieManager {
  async importCookies(
    platform: Platform,
    input: {
      cookieFile?: string;
      cookieString?: string;
      cookieJson?: string;
    },
  ): Promise<ImportedCookies> {
    const providedInputs = [
      input.cookieFile ? "cookieFile" : null,
      input.cookieString ? "cookieString" : null,
      input.cookieJson ? "cookieJson" : null,
    ].filter(Boolean);

    if (providedInputs.length !== 1) {
      throw new AutoCliError(
        "INVALID_LOGIN_INPUT",
        "Provide exactly one of --cookies, --cookie-string, or --cookie-json.",
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
      throw new AutoCliError(
        "SESSION_NOT_FOUND",
        `No saved ${platform} session found for account "${resolvedAccount}".`,
        {
          details: { platform, account: resolvedAccount, sessionPath },
        },
      );
    });

    const raw = await readFile(sessionPath, "utf8");
    const parsed = SessionFileSchema.parse(JSON.parse(raw)) as PlatformSession;
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

      const platform = entry.name as Platform;
      if (platform !== "instagram" && platform !== "linkedin" && platform !== "x" && platform !== "youtube") {
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
      throw new AutoCliError("INVALID_COOKIE_JSON", "Failed to parse cookie JSON.", {
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
      throw new AutoCliError(
        "INVALID_COOKIE_JSON",
        "Cookie JSON must be a cookie jar export or an array of cookie objects.",
      );
    }

    const jar = new CookieJar();
    for (const rawCookie of rawCookies) {
      const parsedCookie = BrowserCookieSchema.safeParse(rawCookie);
      if (!parsedCookie.success) {
        throw new AutoCliError(
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
      await setCookieOnJar(jar, createCookieFromLooseObject(platform, cookie));
    }

    return jar;
  }

  async parseCookieString(platform: Platform, input: string): Promise<CookieJar> {
    const jar = new CookieJar();
    const pairs = input
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    if (pairs.length === 0) {
      throw new AutoCliError("INVALID_COOKIE_STRING", "Cookie string is empty.");
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

      const [domainRaw, , pathRaw, secureFlagRaw, expiresRaw, nameRaw, ...valueParts] = parts;
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
        path,
        secure: secureFlag.toUpperCase() === "TRUE",
        expires: parseCookieExpiry(expiresRaw ?? ""),
      });
      await setCookieOnJar(jar, cookie);
    }

    const cookies = await jar.getCookies(platformOrigin(platform));
    if (cookies.length === 0) {
      throw new AutoCliError("INVALID_COOKIE_FILE", "No usable cookies were found in the cookies.txt file.");
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
      const raw = await readFile(path, "utf8");
      const parsed = SessionFileSchema.parse(JSON.parse(raw)) as PlatformSession;
      sessions.push({ session: parsed, path });
    }

    return sessions.sort((left, right) => right.session.updatedAt.localeCompare(left.session.updatedAt));
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
    throw new AutoCliError("COOKIE_SERIALIZATION_FAILED", "Failed to serialize the cookie jar.");
  }

  return serialized;
}

function platformOrigin(platform: Platform): string {
  return `https://${defaultCookieDomain(platform).replace(/^\./u, "")}/`;
}

function defaultCookieDomain(platform: Platform): string {
  if (platform === "instagram") {
    return "instagram.com";
  }

  if (platform === "linkedin") {
    return "linkedin.com";
  }

  if (platform === "youtube") {
    return "youtube.com";
  }

  return "x.com";
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
    throw new AutoCliError("COOKIE_FILE_NOT_FOUND", `Cookie file not found or unreadable: ${path}`, {
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
  platform: Platform,
  cookie: z.infer<typeof BrowserCookieSchema>,
): Cookie {
  const expiresRaw = cookie.expirationDate ?? cookie.expires;
  return new Cookie({
    key: cookie.name ?? cookie.key ?? "cookie",
    value: cookie.value,
    domain: normalizeCookieDomain(cookie.domain ?? defaultCookieDomain(platform)),
    path: cookie.path ?? "/",
    secure: cookie.secure ?? true,
    httpOnly: cookie.httpOnly ?? false,
    sameSite: normalizeSameSite(cookie.sameSite ?? undefined),
    expires: expiresRaw === undefined ? "Infinity" : parseCookieExpiry(String(expiresRaw)),
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
