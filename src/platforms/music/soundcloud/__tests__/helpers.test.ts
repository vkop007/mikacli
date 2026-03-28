import { describe, expect, test } from "bun:test";

import {
  extractSoundCloudNumericId,
  formatMilliseconds,
  normalizeSoundCloudUrl,
  parseSoundCloudSearchType,
  pickAudioExtension,
} from "../helpers.js";

describe("soundcloud helpers", () => {
  test("normalizes short soundcloud paths", () => {
    expect(normalizeSoundCloudUrl("artist/track")).toBe("https://soundcloud.com/artist/track");
    expect(normalizeSoundCloudUrl("/artist/track")).toBe("https://soundcloud.com/artist/track");
    expect(normalizeSoundCloudUrl("https://soundcloud.com/artist/track")).toBe("https://soundcloud.com/artist/track");
  });

  test("extracts numeric ids", () => {
    expect(extractSoundCloudNumericId("123456")).toBe(123456);
    expect(extractSoundCloudNumericId("artist/track")).toBeUndefined();
  });

  test("formats durations", () => {
    expect(formatMilliseconds(237845)).toBe("3:57");
    expect(formatMilliseconds(3_723_000)).toBe("1:02:03");
  });

  test("parses supported search types", () => {
    expect(parseSoundCloudSearchType("track")).toBe("track");
    expect(parseSoundCloudSearchType("all")).toBe("all");
  });

  test("picks audio extensions from mime type", () => {
    expect(pickAudioExtension("audio/mpeg", "progressive")).toBe(".mp3");
    expect(pickAudioExtension('audio/mp4; codecs="mp4a.40.2"', "hls")).toBe(".m4a");
  });
});
