import type { SessionStatus } from "../../../types.js";

export function buildCookieLlmSessionStatus(input: {
  displayName: string;
  cookieNames: readonly string[];
  authCookieNames: readonly string[];
}): SessionStatus {
  const lastValidatedAt = new Date().toISOString();
  const cookieNames = new Set(input.cookieNames.map((value) => value.toLowerCase()));
  const expectedAuthCookies = input.authCookieNames.map((value) => value.toLowerCase());

  if (cookieNames.size === 0) {
    return {
      state: "expired",
      message: `No ${input.displayName} cookies were found in the imported session.`,
      lastValidatedAt,
      lastErrorCode: "COOKIE_MISSING",
    };
  }

  if (expectedAuthCookies.length === 0) {
    return {
      state: "unknown",
      message: `${input.displayName} cookies were imported, but live validation is deferred until the web request flow is wired.`,
      lastValidatedAt,
    };
  }

  if (expectedAuthCookies.some((cookieName) => hasMatchingCookie(cookieNames, cookieName))) {
    return {
      state: "active",
      message: `${input.displayName} auth cookies were detected. Live endpoint validation is still experimental for this provider.`,
      lastValidatedAt,
    };
  }

  return {
    state: "expired",
    message: `Imported cookies did not include the expected ${input.displayName} auth cookies. Re-export a logged-in browser session.`,
    lastValidatedAt,
    lastErrorCode: "AUTH_COOKIE_MISSING",
  };
}

function hasMatchingCookie(cookieNames: ReadonlySet<string>, expectedCookieName: string): boolean {
  if (!expectedCookieName.endsWith("*")) {
    return cookieNames.has(expectedCookieName);
  }

  const prefix = expectedCookieName.slice(0, -1);
  if (!prefix) {
    return false;
  }

  for (const cookieName of cookieNames) {
    if (cookieName.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}
