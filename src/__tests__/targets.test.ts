import { describe, expect, test } from "bun:test";

import { parseTikTokTarget, parseYouTubeTarget } from "../utils/targets.js";

describe("parseTikTokTarget", () => {
  test("accepts a raw numeric item id", () => {
    expect(parseTikTokTarget("7486727777941556488")).toEqual({
      itemId: "7486727777941556488",
    });
  });

  test("parses a canonical video URL", () => {
    expect(parseTikTokTarget("https://www.tiktok.com/@scout2015/video/6718335390845095173")).toEqual({
      itemId: "6718335390845095173",
      url: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
    });
  });
});

describe("parseYouTubeTarget", () => {
  test("accepts a raw video id", () => {
    expect(parseYouTubeTarget("dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
    });
  });

  test("parses a watch URL", () => {
    expect(parseYouTubeTarget("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  test("parses a youtu.be URL", () => {
    expect(parseYouTubeTarget("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
  });
});
