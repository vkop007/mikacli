import { afterEach, describe, expect, test } from "bun:test";

import { BlueskyAdapter } from "../service.js";

const adapter = new BlueskyAdapter();
const originalFetch = globalThis.fetch;
const originalSaveSession = adapter["saveSession"].bind(adapter);
const originalLoadSession = adapter["loadSession"].bind(adapter);
const originalPersistExistingSession = adapter["persistExistingSession"].bind(adapter);

afterEach(() => {
  globalThis.fetch = originalFetch;
  adapter["saveSession"] = originalSaveSession;
  adapter["loadSession"] = originalLoadSession;
  adapter["persistExistingSession"] = originalPersistExistingSession;
});

describe("bluesky service", () => {
  test("creates a saved session through app-password login", async () => {
    adapter["saveSession"] = (async (input) => {
      expect(input.account).toBe("alice.bsky.social");
      expect(input.user).toEqual(
        expect.objectContaining({
          id: "did:plc:alice",
          username: "alice.bsky.social",
        }),
      );
      expect(input.metadata).toEqual(
        expect.objectContaining({
          service: "https://bsky.social",
          accessJwt: "access-token",
          refreshJwt: "refresh-token",
        }),
      );
      return "/tmp/bluesky-default.json";
    }) as typeof originalSaveSession;

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://bsky.social/xrpc/com.atproto.server.createSession");
      expect(init?.method).toBe("POST");
      expect(String(init?.body ?? "")).toContain('"identifier":"alice.bsky.social"');
      return new Response(
        JSON.stringify({
          did: "did:plc:alice",
          handle: "alice.bsky.social",
          accessJwt: "access-token",
          refreshJwt: "refresh-token",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    const result = await adapter.loginWithCredentials({
      handle: "alice.bsky.social",
      appPassword: "app-password-example",
    });

    expect(result.ok).toBe(true);
    expect(result.account).toBe("alice.bsky.social");
    expect(result.sessionPath).toBe("/tmp/bluesky-default.json");
  });

  test("creates a text post through com.atproto.repo.createRecord", async () => {
    adapter["loadSession"] = (async () => ({
      path: "/tmp/bluesky-default.json",
      session: {
        version: 1,
        platform: "bluesky",
        account: "alice.bsky.social",
        createdAt: "2026-04-09T00:00:00.000Z",
        updatedAt: "2026-04-09T00:00:00.000Z",
        source: {
          kind: "cookie_json",
          importedAt: "2026-04-09T00:00:00.000Z",
          description: "test",
        },
        status: { state: "active" },
        user: {
          id: "did:plc:alice",
          username: "alice.bsky.social",
          profileUrl: "https://bsky.app/profile/alice.bsky.social",
        },
        metadata: {
          service: "https://bsky.social",
          accessJwt: "access-token",
          refreshJwt: "refresh-token",
          did: "did:plc:alice",
          handle: "alice.bsky.social",
        },
        cookieJar: {
          version: "tough-cookie@6.0.0",
          storeType: "MemoryCookieStore",
          rejectPublicSuffixes: true,
          enableLooseMode: false,
          allowSpecialUseDomain: true,
          prefixSecurity: "silent",
          cookies: [],
        },
      },
    })) as typeof originalLoadSession;

    adapter["persistExistingSession"] = (async (session, input) => ({
      ...session,
      status: input.status ?? session.status,
      user: input.user ?? session.user,
      metadata: input.metadata ?? session.metadata,
    })) as typeof originalPersistExistingSession;

    const seenBodies: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://bsky.social/xrpc/com.atproto.server.getSession") {
        return new Response(
          JSON.stringify({
            did: "did:plc:alice",
            handle: "alice.bsky.social",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://bsky.social/xrpc/com.atproto.repo.createRecord") {
        seenBodies.push(String(init?.body ?? ""));
        return new Response(
          JSON.stringify({
            uri: "at://did:plc:alice/app.bsky.feed.post/3lns4example",
            cid: "bafy-test-cid",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    const result = await adapter.postText({
      account: "alice.bsky.social",
      text: "Hello from AutoCLI",
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://bsky.app/profile/alice.bsky.social/post/3lns4example");
    expect(seenBodies[0]).toContain('"collection":"app.bsky.feed.post"');
    expect(seenBodies[0]).toContain('"text":"Hello from AutoCLI"');
  });
});
