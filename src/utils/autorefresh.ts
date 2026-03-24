import { CookieJar } from "tough-cookie";

import { getPlatformAuthCookieNames, getPlatformHomeUrl } from "../platforms.js";
import type { Platform, PlatformSession } from "../types.js";

export type AutoRefreshCapability = "auto" | "manual";

export interface AutoRefreshState {
  capability: AutoRefreshCapability;
  strategy: string;
  lastCheckedAt: string;
  lastReason: string;
  lastAttemptedAt?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  lastOutcome?: "refreshed" | "skipped" | "failed";
  nextRecommendedAt?: string;
  earliestAuthExpiryAt?: string;
  importantCookiesPresent?: string[];
  importantCookiesMissing?: string[];
  lastErrorMessage?: string;
}

export interface AutoRefreshInspection {
  shouldAttempt: boolean;
  reason: string;
  lastCheckedAt: string;
  nextRecommendedAt?: string;
  earliestAuthExpiryAt?: string;
  importantCookiesPresent: string[];
  importantCookiesMissing: string[];
}

export interface AutoRefreshResult {
  attempted: boolean;
  refreshed: boolean;
  metadata: Record<string, unknown>;
  reason: string;
  error?: unknown;
}

const AUTO_REFRESH_KEY = "autoRefresh";
const DEFAULT_KEEPALIVE_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ATTEMPT_COOLDOWN_MS = 15 * 60 * 1000;

export async function maybeAutoRefreshSession(input: {
  platform: Platform;
  session: PlatformSession;
  jar: CookieJar;
  strategy: string;
  capability: AutoRefreshCapability;
  refresh: () => Promise<void>;
  keepaliveIntervalMs?: number;
  refreshWindowMs?: number;
  attemptCooldownMs?: number;
}): Promise<AutoRefreshResult> {
  const inspection = await inspectAutoRefresh(input);
  const previous = readAutoRefreshState(input.session);

  if (!inspection.shouldAttempt) {
    return {
      attempted: false,
      refreshed: false,
      reason: inspection.reason,
      metadata: {
        [AUTO_REFRESH_KEY]: buildAutoRefreshState({
          previous,
          inspection,
          capability: input.capability,
          strategy: input.strategy,
          outcome: "skipped",
        }),
      },
    };
  }

  const attemptedAt = new Date().toISOString();

  try {
    await input.refresh();

    const afterInspection = await inspectAutoRefresh({
      ...input,
      capability: input.capability,
    });

    return {
      attempted: true,
      refreshed: true,
      reason: inspection.reason,
      metadata: {
        [AUTO_REFRESH_KEY]: buildAutoRefreshState({
          previous,
          inspection: afterInspection,
          capability: input.capability,
          strategy: input.strategy,
          outcome: "refreshed",
          attemptedAt,
          succeededAt: new Date().toISOString(),
        }),
      },
    };
  } catch (error) {
    return {
      attempted: true,
      refreshed: false,
      reason: inspection.reason,
      error,
      metadata: {
        [AUTO_REFRESH_KEY]: buildAutoRefreshState({
          previous,
          inspection,
          capability: input.capability,
          strategy: input.strategy,
          outcome: "failed",
          attemptedAt,
          failedAt: new Date().toISOString(),
          error,
        }),
      },
    };
  }
}

export async function inspectAutoRefresh(input: {
  platform: Platform;
  session: PlatformSession;
  jar: CookieJar;
  capability: AutoRefreshCapability;
  strategy?: string;
  keepaliveIntervalMs?: number;
  refreshWindowMs?: number;
  attemptCooldownMs?: number;
}): Promise<AutoRefreshInspection> {
  const now = new Date();
  const importantCookies = getPlatformAuthCookieNames(input.platform);
  const cookies = await input.jar.getCookies(getPlatformHomeUrl(input.platform));
  const cookieMap = new Map(cookies.map((cookie) => [cookie.key, cookie]));
  const present = importantCookies.filter((name) => cookieMap.has(name));
  const missing = importantCookies.filter((name) => !cookieMap.has(name));
  const earliestAuthExpiryAt = getEarliestExpiry(present.map((name) => cookieMap.get(name)!));
  const previous = readAutoRefreshState(input.session);
  const keepaliveIntervalMs = input.keepaliveIntervalMs ?? DEFAULT_KEEPALIVE_INTERVAL_MS;
  const refreshWindowMs = input.refreshWindowMs ?? DEFAULT_REFRESH_WINDOW_MS;
  const attemptCooldownMs = input.attemptCooldownMs ?? DEFAULT_ATTEMPT_COOLDOWN_MS;

  if (input.capability === "manual") {
    return {
      shouldAttempt: false,
      reason: "manual_only",
      lastCheckedAt: now.toISOString(),
      nextRecommendedAt: previous?.nextRecommendedAt,
      earliestAuthExpiryAt,
      importantCookiesPresent: present,
      importantCookiesMissing: missing,
    };
  }

  if (missing.length > 0) {
    return {
      shouldAttempt: false,
      reason: "missing_auth_cookies",
      lastCheckedAt: now.toISOString(),
      earliestAuthExpiryAt,
      importantCookiesPresent: present,
      importantCookiesMissing: missing,
    };
  }

  const lastAttemptedAt = parseIso(previous?.lastAttemptedAt);
  if (lastAttemptedAt && now.getTime() - lastAttemptedAt.getTime() < attemptCooldownMs) {
    return {
      shouldAttempt: false,
      reason: "cooldown_active",
      lastCheckedAt: now.toISOString(),
      nextRecommendedAt: new Date(lastAttemptedAt.getTime() + attemptCooldownMs).toISOString(),
      earliestAuthExpiryAt,
      importantCookiesPresent: present,
      importantCookiesMissing: missing,
    };
  }

  if (earliestAuthExpiryAt) {
    const expiry = new Date(earliestAuthExpiryAt);
    if (expiry.getTime() - now.getTime() <= refreshWindowMs) {
      return {
        shouldAttempt: true,
        reason: "auth_cookie_expiring_soon",
        lastCheckedAt: now.toISOString(),
        nextRecommendedAt: earliestAuthExpiryAt,
        earliestAuthExpiryAt,
        importantCookiesPresent: present,
        importantCookiesMissing: missing,
      };
    }
  }

  const lastSucceededAt = parseIso(previous?.lastSucceededAt);
  if (!lastSucceededAt || now.getTime() - lastSucceededAt.getTime() >= keepaliveIntervalMs) {
    return {
      shouldAttempt: true,
      reason: lastSucceededAt ? "keepalive_due" : "initial_keepalive_due",
      lastCheckedAt: now.toISOString(),
      nextRecommendedAt: new Date(now.getTime() + keepaliveIntervalMs).toISOString(),
      earliestAuthExpiryAt,
      importantCookiesPresent: present,
      importantCookiesMissing: missing,
    };
  }

  return {
    shouldAttempt: false,
    reason: "fresh_enough",
    lastCheckedAt: now.toISOString(),
    nextRecommendedAt: new Date(lastSucceededAt.getTime() + keepaliveIntervalMs).toISOString(),
    earliestAuthExpiryAt,
    importantCookiesPresent: present,
    importantCookiesMissing: missing,
  };
}

function buildAutoRefreshState(input: {
  previous?: AutoRefreshState;
  inspection: AutoRefreshInspection;
  capability: AutoRefreshCapability;
  strategy: string;
  outcome: AutoRefreshState["lastOutcome"];
  attemptedAt?: string;
  succeededAt?: string;
  failedAt?: string;
  error?: unknown;
}): AutoRefreshState {
  return {
    capability: input.capability,
    strategy: input.strategy,
    lastCheckedAt: input.inspection.lastCheckedAt,
    lastReason: input.inspection.reason,
    lastAttemptedAt: input.attemptedAt ?? input.previous?.lastAttemptedAt,
    lastSucceededAt: input.succeededAt ?? input.previous?.lastSucceededAt,
    lastFailedAt: input.failedAt ?? input.previous?.lastFailedAt,
    lastOutcome: input.outcome,
    nextRecommendedAt: input.inspection.nextRecommendedAt,
    earliestAuthExpiryAt: input.inspection.earliestAuthExpiryAt,
    importantCookiesPresent: input.inspection.importantCookiesPresent,
    importantCookiesMissing: input.inspection.importantCookiesMissing,
    lastErrorMessage:
      input.outcome === "failed"
        ? getErrorMessage(input.error)
        : input.outcome === "refreshed"
          ? undefined
          : input.previous?.lastErrorMessage,
  };
}

function readAutoRefreshState(session: PlatformSession): AutoRefreshState | undefined {
  const value = session.metadata?.[AUTO_REFRESH_KEY];
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<AutoRefreshState>;
  if (!candidate.strategy || typeof candidate.strategy !== "string") {
    return undefined;
  }

  return {
    capability: candidate.capability === "manual" ? "manual" : "auto",
    strategy: candidate.strategy,
    lastCheckedAt: typeof candidate.lastCheckedAt === "string" ? candidate.lastCheckedAt : "",
    lastReason: typeof candidate.lastReason === "string" ? candidate.lastReason : "unknown",
    lastAttemptedAt: typeof candidate.lastAttemptedAt === "string" ? candidate.lastAttemptedAt : undefined,
    lastSucceededAt: typeof candidate.lastSucceededAt === "string" ? candidate.lastSucceededAt : undefined,
    lastFailedAt: typeof candidate.lastFailedAt === "string" ? candidate.lastFailedAt : undefined,
    lastOutcome:
      candidate.lastOutcome === "failed" || candidate.lastOutcome === "refreshed" || candidate.lastOutcome === "skipped"
        ? candidate.lastOutcome
        : undefined,
    nextRecommendedAt: typeof candidate.nextRecommendedAt === "string" ? candidate.nextRecommendedAt : undefined,
    earliestAuthExpiryAt:
      typeof candidate.earliestAuthExpiryAt === "string" ? candidate.earliestAuthExpiryAt : undefined,
    importantCookiesPresent: Array.isArray(candidate.importantCookiesPresent)
      ? candidate.importantCookiesPresent.filter((value): value is string => typeof value === "string")
      : undefined,
    importantCookiesMissing: Array.isArray(candidate.importantCookiesMissing)
      ? candidate.importantCookiesMissing.filter((value): value is string => typeof value === "string")
      : undefined,
    lastErrorMessage: typeof candidate.lastErrorMessage === "string" ? candidate.lastErrorMessage : undefined,
  };
}

function getEarliestExpiry(cookies: Array<{ expires?: Date | "Infinity" | string | null }>): string | undefined {
  const finiteDates = cookies
    .map((cookie) => cookie.expires)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  if (finiteDates.length === 0) {
    return undefined;
  }

  finiteDates.sort((left, right) => left.getTime() - right.getTime());
  return finiteDates[0]?.toISOString();
}

function parseIso(input?: string): Date | undefined {
  if (!input) {
    return undefined;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : undefined;
}
