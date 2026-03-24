import { describe, expect, test } from "bun:test";
import { Cookie, CookieJar } from "tough-cookie";

import { inspectAutoRefresh, maybeAutoRefreshSession } from "../utils/autorefresh.js";
import { serializeCookieJar } from "../utils/cookie-manager.js";
import type { PlatformSession } from "../types.js";

function createSession(platform: PlatformSession["platform"], metadata?: Record<string, unknown>): PlatformSession {
  return {
    version: 1,
    platform,
    account: "default",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    source: {
      kind: "cookie_json",
      importedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      description: "test",
    },
    status: {
      state: "active",
    },
    metadata,
    cookieJar: serializeCookieJar(new CookieJar()),
  };
}

async function addCookie(
  jar: CookieJar,
  url: string,
  input: {
    key: string;
    value: string;
    expires?: Date | "Infinity";
  },
): Promise<void> {
  await jar.setCookie(
    new Cookie({
      key: input.key,
      value: input.value,
      domain: new URL(url).hostname,
      path: "/",
      secure: true,
      expires: input.expires ?? "Infinity",
    }),
    url,
  );
}

describe("autorefresh", () => {
  test("requests refresh when auth cookies expire soon", async () => {
    const jar = new CookieJar();
    const expiry = new Date(Date.now() + 30 * 60 * 1000);
    await addCookie(jar, "https://x.com/", { key: "auth_token", value: "aaa", expires: expiry });
    await addCookie(jar, "https://x.com/", { key: "ct0", value: "bbb", expires: expiry });

    const inspection = await inspectAutoRefresh({
      platform: "x",
      session: createSession("x"),
      jar,
      capability: "auto",
    });

    expect(inspection.shouldAttempt).toBe(true);
    expect(inspection.reason).toBe("auth_cookie_expiring_soon");
  });

  test("skips refresh for manual-only platforms", async () => {
    const jar = new CookieJar();
    await addCookie(jar, "https://www.linkedin.com/", { key: "li_at", value: "aaa" });
    await addCookie(jar, "https://www.linkedin.com/", { key: "JSESSIONID", value: "\"ajax:123\"" });

    const inspection = await inspectAutoRefresh({
      platform: "linkedin",
      session: createSession("linkedin"),
      jar,
      capability: "manual",
    });

    expect(inspection.shouldAttempt).toBe(false);
    expect(inspection.reason).toBe("manual_only");
  });

  test("records a successful refresh attempt in metadata", async () => {
    const jar = new CookieJar();
    await addCookie(jar, "https://www.instagram.com/", { key: "sessionid", value: "aaa" });
    await addCookie(jar, "https://www.instagram.com/", { key: "csrftoken", value: "bbb" });
    await addCookie(jar, "https://www.instagram.com/", { key: "ds_user_id", value: "123" });

    const result = await maybeAutoRefreshSession({
      platform: "instagram",
      session: createSession("instagram"),
      jar,
      capability: "auto",
      strategy: "homepage_keepalive",
      refresh: async () => {},
      keepaliveIntervalMs: 0,
    });

    const state = result.metadata.autoRefresh as Record<string, unknown>;
    expect(result.attempted).toBe(true);
    expect(result.refreshed).toBe(true);
    expect(state.lastOutcome).toBe("refreshed");
    expect(typeof state.lastSucceededAt).toBe("string");
  });
});
