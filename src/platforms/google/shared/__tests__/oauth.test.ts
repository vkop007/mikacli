import { describe, expect, test } from "bun:test";

import { buildGoogleAuthUrl, GoogleOAuthClient } from "../oauth.js";

function createFetchMock(
  responses: Array<{
    body: unknown;
    status?: number;
  }>,
): typeof fetch {
  return (async () => {
    const next = responses.shift();
    if (!next) {
      throw new Error("Unexpected fetch call.");
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as unknown as typeof fetch;
}

describe("Google OAuth helpers", () => {
  test("builds an offline consent URL with the requested scopes", () => {
    const url = new URL(buildGoogleAuthUrl({
      clientId: "google-client-id-example",
      redirectUri: "http://127.0.0.1:3333/callback",
      scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"],
      state: "state-example",
      loginHint: "person@example.com",
    }));

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("google-client-id-example");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3333/callback");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-example");
    expect(url.searchParams.get("login_hint")).toBe("person@example.com");
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/gmail.readonly");
  });

  test("parses authorization-code token exchanges", async () => {
    const client = new GoogleOAuthClient({
      clientId: "google-client-id-example",
      clientSecret: "google-client-secret-example",
      fetchImpl: createFetchMock([
        {
          body: {
            access_token: "google-access-token-example",
            refresh_token: "google-refresh-token-example",
            expires_in: 3600,
            scope: "openid email profile https://www.googleapis.com/auth/drive",
            token_type: "Bearer",
          },
        },
      ]),
    });

    const token = await client.exchangeCode({
      code: "google-auth-code-example",
      redirectUri: "http://127.0.0.1:3333/callback",
    });

    expect(token.accessToken).toBe("google-access-token-example");
    expect(token.refreshToken).toBe("google-refresh-token-example");
    expect(token.tokenType).toBe("Bearer");
    expect(token.scopes).toContain("https://www.googleapis.com/auth/drive");
    expect(typeof token.expiresAt).toBe("string");
  });

  test("maps userinfo fields into the internal profile shape", async () => {
    const client = new GoogleOAuthClient({
      clientId: "google-client-id-example",
      clientSecret: "google-client-secret-example",
      fetchImpl: createFetchMock([
        {
          body: {
            sub: "google-user-id-example",
            email: "person@example.com",
            email_verified: true,
            name: "Example Person",
            given_name: "Example",
            family_name: "Person",
            picture: "https://example.com/avatar.png",
            hd: "example.com",
          },
        },
      ]),
    });

    const profile = await client.getUserProfile("google-access-token-example");

    expect(profile).toEqual({
      sub: "google-user-id-example",
      email: "person@example.com",
      emailVerified: true,
      name: "Example Person",
      givenName: "Example",
      familyName: "Person",
      picture: "https://example.com/avatar.png",
      hostedDomain: "example.com",
    });
  });
});
