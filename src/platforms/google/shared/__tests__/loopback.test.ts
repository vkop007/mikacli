import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";

import { AutoCliError } from "../../../../errors.js";
import { startGoogleLoopbackAuthorization } from "../loopback.js";

const LOOPBACK_AVAILABLE = await probeLoopbackAvailability();

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
      expect(error).toBeInstanceOf(AutoCliError);
      expect((error as AutoCliError).code).toBe("GOOGLE_OAUTH_STATE_MISMATCH");
    }

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
