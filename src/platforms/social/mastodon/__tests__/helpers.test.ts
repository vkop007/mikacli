import { describe, expect, test } from "bun:test";

import { buildMastodonProfileUrl, buildMastodonStatusUrl, parseMastodonSearchTarget } from "../helpers.js";

describe("mastodon helpers", () => {
  test("parses mastodon profile urls", () => {
    expect(parseMastodonSearchTarget("https://mastodon.social/@Gargron")).toEqual({
      baseUrl: "https://mastodon.social",
      handle: "Gargron",
      url: "https://mastodon.social/@Gargron",
    });
  });

  test("parses mastodon thread urls", () => {
    expect(parseMastodonSearchTarget("https://mastodon.social/@Gargron/111111111111111111")).toEqual({
      baseUrl: "https://mastodon.social",
      handle: "Gargron",
      statusId: "111111111111111111",
      url: "https://mastodon.social/@Gargron/111111111111111111",
    });
  });

  test("builds mastodon urls", () => {
    expect(buildMastodonProfileUrl("https://mastodon.social", "Gargron")).toBe("https://mastodon.social/@Gargron");
    expect(buildMastodonStatusUrl("https://mastodon.social", "Gargron", "111")).toBe("https://mastodon.social/@Gargron/111");
  });
});
