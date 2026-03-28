import { afterEach, describe, expect, test } from "bun:test";

import { mastodonAdapter } from "../service.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("mastodon service", () => {
  test("thread uses canonical status urls and accepts a bare numeric id", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);

      if (url === "https://mastodon.social/api/v1/statuses/116306409081398966") {
        return new Response(
          JSON.stringify({
            id: "116306409350469319",
            url: "https://mastodon.social/@Gargron/116306409081398966",
            content: "<p>Hello world</p>",
            created_at: "2026-03-28T10:49:22.799Z",
            account: {
              id: "1",
              username: "Gargron",
              acct: "Gargron",
              display_name: "Eugen Rochko",
              url: "https://mastodon.social/@Gargron",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://mastodon.social/api/v1/statuses/116306409081398966/context") {
        return new Response(
          JSON.stringify({
            ancestors: [],
            descendants: [
              {
                id: "116306409350469320",
                url: "https://mastodon.social/@Gargron/116306409081398967",
                content: "<p>Reply</p>",
                created_at: "2026-03-28T10:50:22.799Z",
                account: {
                  id: "1",
                  username: "Gargron",
                  acct: "Gargron",
                  display_name: "Eugen Rochko",
                  url: "https://mastodon.social/@Gargron",
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    const result = await mastodonAdapter.threadInfo({
      target: "116306409081398966",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://mastodon.social/@Gargron/116306409081398966");
    expect(result.data?.thread).toMatchObject({
      id: "116306409350469319",
      url: "https://mastodon.social/@Gargron/116306409081398966",
    });
    expect(result.data?.replies).toEqual([
      expect.objectContaining({
        id: "116306409350469320",
        url: "https://mastodon.social/@Gargron/116306409081398967",
      }),
    ]);
  });
});
