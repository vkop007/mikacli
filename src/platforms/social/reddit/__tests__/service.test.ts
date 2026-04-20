import { afterEach, describe, expect, test } from "bun:test";

import { redditAdapter } from "../adapter.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("reddit service", () => {
  test("loads a public reddit thread with mapped replies", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);

      if (url === "https://www.reddit.com/comments/1abc123.json?limit=5&raw_json=1") {
        return new Response(
          JSON.stringify([
            {
              data: {
                children: [
                  {
                    kind: "t3",
                    data: {
                      id: "1abc123",
                      title: "MikaCLI launch",
                      selftext: "Shipping Reddit support.",
                      author: "example_author",
                      subreddit: "programming",
                      subreddit_name_prefixed: "r/programming",
                      permalink: "/r/programming/comments/1abc123/mikacli_launch/",
                      created_utc: 1774769793,
                      score: 42,
                      num_comments: 3,
                    },
                  },
                ],
              },
            },
            {
              data: {
                children: [
                  {
                    kind: "t1",
                    data: {
                      id: "c1",
                      body: "Nice work",
                      author: "reader1",
                      permalink: "/r/programming/comments/1abc123/mikacli_launch/c1/",
                      subreddit: "programming",
                      subreddit_name_prefixed: "r/programming",
                      created_utc: 1774769800,
                      score: 5,
                    },
                  },
                  {
                    kind: "t1",
                    data: {
                      id: "c2",
                      body: "Looks useful",
                      author: "reader2",
                      permalink: "/r/programming/comments/1abc123/mikacli_launch/c2/",
                      subreddit: "programming",
                      created_utc: 1774769801,
                      score: 4,
                    },
                  },
                ],
              },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    const result = await redditAdapter.threadInfo({
      target: "1abc123",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBe("1abc123");
    expect(result.url).toBe("https://www.reddit.com/r/programming/comments/1abc123/mikacli_launch/");
    expect(result.data?.thread).toMatchObject({
      id: "1abc123",
      title: "MikaCLI launch",
      username: "example_author",
    });
    expect(result.data?.replies).toEqual([
      expect.objectContaining({
        id: "c1",
        username: "reader1",
      }),
      expect.objectContaining({
        id: "c2",
        username: "reader2",
      }),
    ]);
  });
});
