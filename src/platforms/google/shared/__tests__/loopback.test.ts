import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:http";

import { MikaCliError } from "../../../../errors.js";
import { openManagedGoogleOAuthConsent } from "../base.js";
import { startGoogleLoopbackAuthorization } from "../loopback.js";

import type { MimikaBrowserGateway } from "../../../../utils/mimika-browser-client.js";

const LOOPBACK_AVAILABLE = await probeLoopbackAvailability();
const previousManaged = process.env.MIMIKA_MIKACLI_MANAGED;

afterEach(() => {
  if (previousManaged === undefined) delete process.env.MIMIKA_MIKACLI_MANAGED;
  else process.env.MIMIKA_MIKACLI_MANAGED = previousManaged;
});

test("managed Google OAuth opens and closes only the consent tab in Mimika", async () => {
  process.env.MIMIKA_MIKACLI_MANAGED = "1";
  const calls: string[] = [];
  const gateway = {
    async getCapabilities() { calls.push("capabilities"); return {} as never; },
    async openTab(url: string) { calls.push(`open:${url}`); return "pw:google_oauth" as const; },
    async closeTab(handle: string) { calls.push(`close:${handle}`); },
    async exportOriginSession() { throw new Error("OAuth must not export a cookie session"); },
  } satisfies MimikaBrowserGateway;

  const close = await openManagedGoogleOAuthConsent(
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=example",
    gateway,
  );
  await close();
  expect(calls).toEqual([
    "capabilities",
    "open:https://accounts.google.com/o/oauth2/v2/auth?client_id=example",
    "close:pw:google_oauth",
  ]);
  await expect(openManagedGoogleOAuthConsent("https://evil.example/oauth", gateway)).rejects.toMatchObject({
    code: "MIMIKA_BROWSER_SCOPE_VIOLATION",
  });
});

describe("Google loopback authorization", () => {
  if (!LOOPBACK_AVAILABLE) {
    test("skips when localhost listeners are unavailable in this environment", () => {
      expect(LOOPBACK_AVAILABLE).toBe(false);
    });
    return;
  }

  test("captures an authorization code over localhost", async () => {
    const flow = await startGoogleLoopbackAuthorization({
      clientId: "google-client-id-example",
      scopes: ["openid", "email", "profile"],
      buildAuthUrl: ({ redirectUri, state }) =>
        `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
    });

    const response = await fetch(`${flow.redirectUri}?code=google-auth-code-example&state=${flow.state}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Google login captured");
    await expect(flow.waitForCode()).resolves.toBe("google-auth-code-example");
    await flow.close();
  });

  test("rejects a mismatched state parameter", async () => {
    const flow = await startGoogleLoopbackAuthorization({
      clientId: "google-client-id-example",
      scopes: ["openid", "email", "profile"],
      redirectUri: "http://127.0.0.1/callback",
      buildAuthUrl: ({ redirectUri, state }) =>
        `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
    });

    const response = await fetch(`${flow.redirectUri}?code=google-auth-code-example&state=wrong-state-example`);
    expect(response.status).toBe(400);

    try {
      await flow.waitForCode();
      throw new Error("Expected the loopback authorization to reject.");
    } catch (error) {
      expect(error).toBeInstanceOf(MikaCliError);
      expect((error as MikaCliError).code).toBe("GOOGLE_OAUTH_STATE_MISMATCH");
    }

    await flow.close();
  });

  test("ignores a plain callback hit before the real Google redirect arrives", async () => {
    const flow = await startGoogleLoopbackAuthorization({
      clientId: "google-client-id-example",
      scopes: ["openid", "email", "profile"],
      redirectUri: "http://127.0.0.1/callback",
      buildAuthUrl: ({ redirectUri, state }) =>
        `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
    });

    const strayResponse = await fetch(flow.redirectUri);
    expect(strayResponse.status).toBe(400);

    const callbackResponse = await fetch(`${flow.redirectUri}?code=google-auth-code-example&state=${flow.state}`);
    expect(callbackResponse.status).toBe(200);
    await expect(flow.waitForCode()).resolves.toBe("google-auth-code-example");

    await flow.close();
  });
});

async function probeLoopbackAvailability(): Promise<boolean> {
  const server = createServer(() => {});

  return new Promise<boolean>((resolve) => {
    const finish = (value: boolean) => {
      try {
        server.close();
      } catch {}
      resolve(value);
    };

    server.once("error", () => finish(false));
    server.listen(0, "127.0.0.1", () => finish(true));
  });
}
