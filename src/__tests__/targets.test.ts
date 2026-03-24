import { describe, expect, test } from "bun:test";

import {
  parseFacebookTarget,
  parseTikTokTarget,
  parseYouTubeChannelTarget,
  parseYouTubePlaylistTarget,
  parseYouTubeTarget,
} from "../utils/targets.js";

describe("parseFacebookTarget", () => {
  test("accepts a raw numeric object id", () => {
    expect(parseFacebookTarget("123456789012345")).toEqual({
      objectId: "123456789012345",
    });
  });

  test("parses a permalink URL", () => {
    expect(parseFacebookTarget("https://www.facebook.com/permalink.php?story_fbid=456&id=123")).toEqual({
      objectId: "123_456",
      url: "https://www.facebook.com/permalink.php?story_fbid=456&id=123",
    });
  });
});

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

describe("parseYouTubeChannelTarget", () => {
  test("accepts a raw channel id", () => {
    expect(parseYouTubeChannelTarget("UCuAXFkgsw1L7xaCfnd5JJOw")).toEqual({
      channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
    });
  });

  test("parses a /channel URL", () => {
    expect(parseYouTubeChannelTarget("https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw")).toEqual({
      channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
      url: "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
    });
  });

  test("parses a handle target", () => {
    expect(parseYouTubeChannelTarget("@RickAstleyYT")).toEqual({
      handle: "@RickAstleyYT",
    });
  });
});

describe("parseYouTubePlaylistTarget", () => {
  test("accepts a raw playlist id", () => {
    expect(parseYouTubePlaylistTarget("PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI")).toEqual({
      playlistId: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
    });
  });

  test("parses a playlist url", () => {
    expect(parseYouTubePlaylistTarget("https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI")).toEqual({
      playlistId: "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
      url: "https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
    });
  });
});
