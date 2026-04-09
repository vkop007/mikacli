import { describe, expect, test } from "bun:test";

import { buildFacebookBrowserTarget, extractFacebookPostIdFromMutationBody, normalizeFacebookText } from "../service.js";

describe("facebook service helpers", () => {
  test("normalizes whitespace for browser-backed post text", () => {
    expect(normalizeFacebookText("  Hello\n\nFacebook   world  ")).toBe("Hello Facebook world");
  });

  test("builds a permalink URL from a compound profile_post id target", () => {
    expect(buildFacebookBrowserTarget("456_123")).toEqual({
      objectId: "456_123",
      url: "https://www.facebook.com/permalink.php?story_fbid=123&id=456",
    });
  });

  test("preserves explicit facebook urls when building browser targets", () => {
    expect(buildFacebookBrowserTarget("https://www.facebook.com/reel/987654321")).toEqual({
      objectId: "987654321",
      url: "https://www.facebook.com/reel/987654321",
    });
  });

  test("accepts profile timeline urls for top-post browser actions", () => {
    expect(buildFacebookBrowserTarget("https://www.facebook.com/vikashkhati007")).toEqual({
      objectId: "vikashkhati007",
      url: "https://www.facebook.com/vikashkhati007",
    });
  });

  test("extracts facebook post ids from common mutation payload fragments", () => {
    expect(extractFacebookPostIdFromMutationBody('{"top_level_post_id":"1234567890"}')).toBe("1234567890");
    expect(extractFacebookPostIdFromMutationBody("story_fbid=24680&id=13579")).toBe("24680");
    expect(extractFacebookPostIdFromMutationBody("")).toBeUndefined();
  });
});
