import { describe, expect, test } from "bun:test";

import {
  instagramMediaIdToShortcode,
  parseAmazonProductTarget,
  parseFacebookTarget,
  parseFlipkartProductTarget,
  parseInstagramProfileTarget,
  parseInstagramTarget,
  parseSpotifyAlbumTarget,
  parseSpotifyArtistTarget,
  parseSpotifyEntityTarget,
  parseSpotifyPlaylistTarget,
  parseSpotifyTrackTarget,
  parseTikTokTarget,
  parseTwitchProfileTarget,
  parseXProfileTarget,
  parseXTarget,
  parseYouTubeChannelTarget,
  parseYouTubePlaylistTarget,
  parseYouTubeTarget,
} from "../utils/targets.js";

describe("parseAmazonProductTarget", () => {
  test("accepts a raw ASIN", () => {
    expect(parseAmazonProductTarget("B0B296NTFV")).toEqual({
      asin: "B0B296NTFV",
    });
  });

  test("parses an Amazon product URL", () => {
    expect(parseAmazonProductTarget("https://www.amazon.in/Portronics-Wireless-Optical-Orientation-Adjustable/dp/B0B296NTFV")).toEqual({
      asin: "B0B296NTFV",
      url: "https://www.amazon.in/Portronics-Wireless-Optical-Orientation-Adjustable/dp/B0B296NTFV",
    });
  });
});

describe("parseFlipkartProductTarget", () => {
  test("accepts a raw Flipkart pid", () => {
    expect(parseFlipkartProductTarget("ACCH9SPTRHTWG8QH")).toEqual({
      pid: "ACCH9SPTRHTWG8QH",
    });
  });

  test("parses a Flipkart product URL", () => {
    expect(parseFlipkartProductTarget("https://www.flipkart.com/example/p/itm81863fec34057?pid=ACCH9SPTRHTWG8QH")).toEqual({
      pid: "ACCH9SPTRHTWG8QH",
      url: "https://www.flipkart.com/example/p/itm81863fec34057?pid=ACCH9SPTRHTWG8QH",
    });
  });
});

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

describe("parseSpotifyEntityTarget", () => {
  test("parses a spotify track url", () => {
    expect(parseSpotifyEntityTarget("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toEqual({
      type: "track",
      id: "4uLU6hMCjMI75M1A2tKUQC",
      url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    });
  });

  test("parses a spotify artist uri", () => {
    expect(parseSpotifyEntityTarget("spotify:artist:0gxyHStUsqpMadRV0Di1Qt")).toEqual({
      type: "artist",
      id: "0gxyHStUsqpMadRV0Di1Qt",
      uri: "spotify:artist:0gxyHStUsqpMadRV0Di1Qt",
    });
  });
});

describe("parseSpotifyTrackTarget", () => {
  test("accepts a raw track id", () => {
    expect(parseSpotifyTrackTarget("4uLU6hMCjMI75M1A2tKUQC")).toEqual({
      trackId: "4uLU6hMCjMI75M1A2tKUQC",
    });
  });
});

describe("parseSpotifyAlbumTarget", () => {
  test("parses a canonical album url", () => {
    expect(parseSpotifyAlbumTarget("https://open.spotify.com/album/6JWc4iAiJ9FjyK0B59ABb4")).toEqual({
      albumId: "6JWc4iAiJ9FjyK0B59ABb4",
      url: "https://open.spotify.com/album/6JWc4iAiJ9FjyK0B59ABb4",
    });
  });
});

describe("parseSpotifyArtistTarget", () => {
  test("accepts a raw artist id", () => {
    expect(parseSpotifyArtistTarget("0gxyHStUsqpMadRV0Di1Qt")).toEqual({
      artistId: "0gxyHStUsqpMadRV0Di1Qt",
    });
  });
});

describe("parseSpotifyPlaylistTarget", () => {
  test("parses a canonical playlist url", () => {
    expect(parseSpotifyPlaylistTarget("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toEqual({
      playlistId: "37i9dQZF1DXcBWIGoYBM5M",
      url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    });
  });
});

describe("parseInstagramTarget", () => {
  test("accepts a raw numeric media id", () => {
    expect(parseInstagramTarget("3859277693849754125")).toEqual({
      mediaId: "3859277693849754125",
    });
  });

  test("parses a canonical post URL", () => {
    expect(parseInstagramTarget("https://www.instagram.com/p/DWO6J1_gNoN/")).toEqual({
      mediaId: "3859277693849754125",
      shortcode: "DWO6J1_gNoN",
      url: "https://www.instagram.com/p/DWO6J1_gNoN/",
    });
  });
});

describe("instagramMediaIdToShortcode", () => {
  test("round-trips a canonical Instagram media id into its shortcode", () => {
    expect(instagramMediaIdToShortcode("3859277693849754125")).toBe("DWO6J1_gNoN");
  });
});

describe("parseInstagramProfileTarget", () => {
  test("parses a raw username", () => {
    expect(parseInstagramProfileTarget("blackpink")).toEqual({
      username: "blackpink",
    });
  });

  test("parses a handle target", () => {
    expect(parseInstagramProfileTarget("@blackpink")).toEqual({
      username: "blackpink",
    });
  });

  test("parses a profile URL", () => {
    expect(parseInstagramProfileTarget("https://www.instagram.com/blackpink/")).toEqual({
      username: "blackpink",
      url: "https://www.instagram.com/blackpink/",
    });
  });
});

describe("parseXTarget", () => {
  test("accepts a raw numeric tweet id", () => {
    expect(parseXTarget("2035857535140545016")).toEqual({
      tweetId: "2035857535140545016",
    });
  });

  test("parses a status URL", () => {
    expect(parseXTarget("https://x.com/elonmusk/status/2035857535140545016")).toEqual({
      tweetId: "2035857535140545016",
      url: "https://x.com/elonmusk/status/2035857535140545016",
    });
  });
});

describe("parseXProfileTarget", () => {
  test("parses a raw handle", () => {
    expect(parseXProfileTarget("OpenAI")).toEqual({
      username: "OpenAI",
    });
  });

  test("parses an @handle", () => {
    expect(parseXProfileTarget("@OpenAI")).toEqual({
      username: "OpenAI",
    });
  });

  test("parses a profile URL", () => {
    expect(parseXProfileTarget("https://x.com/OpenAI")).toEqual({
      username: "OpenAI",
      url: "https://x.com/OpenAI",
    });
  });
});

describe("parseTwitchProfileTarget", () => {
  test("parses a raw login", () => {
    expect(parseTwitchProfileTarget("twitch")).toEqual({
      username: "twitch",
    });
  });

  test("parses a handle target", () => {
    expect(parseTwitchProfileTarget("@twitch")).toEqual({
      username: "twitch",
    });
  });

  test("parses a channel URL", () => {
    expect(parseTwitchProfileTarget("https://www.twitch.tv/twitch/videos")).toEqual({
      username: "twitch",
      url: "https://www.twitch.tv/twitch/videos",
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
