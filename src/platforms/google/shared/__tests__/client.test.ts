import { describe, expect, test } from "bun:test";

import { GoogleApiClient } from "../client.js";

describe("GoogleApiClient", () => {
  test("keeps base API paths when callers pass a leading slash", async () => {
    const seen: string[] = [];
    const client = new GoogleApiClient({
      accessToken: "google-access-token-example",
      baseUrl: "https://gmail.googleapis.com/gmail/v1/users/me",
      errorCode: "GOOGLE_API_ERROR",
      fetchImpl: (async (input) => {
        seen.push(String(input));
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
          },
        });
      }) as typeof fetch,
    });

    await client.json("/profile");

    expect(seen).toEqual(["https://gmail.googleapis.com/gmail/v1/users/me/profile"]);
  });
});
