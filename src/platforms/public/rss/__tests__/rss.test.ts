import { describe, expect, test } from "bun:test";

import { normalizeFeedUrl } from "../adapter.js";

describe("rss adapter helpers", () => {
  test("normalizes feed urls", () => {
    expect(normalizeFeedUrl("https://example.com/feed.xml")).toBe("https://example.com/feed.xml");
    expect(normalizeFeedUrl("example.com/feed.xml")).toBe("https://example.com/feed.xml");
  });
});
