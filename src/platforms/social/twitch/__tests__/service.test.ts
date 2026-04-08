import { afterEach, describe, expect, test } from "bun:test";

import { TwitchAdapter, parseTwitchClipPeriodOption } from "../service.js";

const adapter = new TwitchAdapter();
const originalFetch = globalThis.fetch;
const originalLoadSession = adapter["loadSession"].bind(adapter);

afterEach(() => {
  globalThis.fetch = originalFetch;
  adapter["loadSession"] = originalLoadSession;
});

describe("twitch service", () => {
  test("maps search results into normalized items", async () => {
    adapter["loadSession"] = (async () => ({
      path: "/tmp/twitch.json",
      session: {
        version: 1,
        platform: "twitch",
        account: "default",
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:00.000Z",
        source: {
          kind: "cookie_json",
          importedAt: "2026-04-08T00:00:00.000Z",
          description: "test",
        },
        status: { state: "active" },
        user: {
          id: "1",
          username: "example_user",
        },
        metadata: {
          accessToken: "token",
          clientId: "kimne78kx3ncx6brgo4mv6wki5h1ko",
          login: "example_user",
          userId: "1",
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

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://gql.twitch.tv/gql") {
        return new Response(
          JSON.stringify([
            {
              data: {
                searchFor: {
                  channels: {
                    edges: [
                      {
                        item: {
                          id: "12826",
                          login: "twitch",
                          displayName: "Twitch",
                          description: "Streaming home",
                          followers: { totalCount: 2421393 },
                          profileImageURL: "https://static-cdn.jtvnw.net/profile.png",
                          latestVideo: { edges: [{ node: { id: "2734873837" } }] },
                          topClip: { edges: [{ node: { url: "https://www.twitch.tv/twitch/clip/example" } }] },
                          stream: {
                            viewersCount: 184,
                            game: { displayName: "Just Chatting" },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    const result = await adapter.search({
      account: "default",
      query: "twitch",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.items).toEqual([
      expect.objectContaining({
        id: "12826",
        username: "twitch",
        title: "Twitch",
        followers: 2421393,
        latestVideoUrl: "https://www.twitch.tv/videos/2734873837",
        topClipUrl: "https://www.twitch.tv/twitch/clip/example",
      }),
    ]);
  });

  test("parses clip period aliases", () => {
    expect(parseTwitchClipPeriodOption("all")).toBe("all-time");
    expect(parseTwitchClipPeriodOption("last-week")).toBe("last-week");
    expect(parseTwitchClipPeriodOption("day")).toBe("last-day");
    expect(() => parseTwitchClipPeriodOption("month")).toThrow("Expected --period to be all-time, last-week, or last-day.");
  });
});
