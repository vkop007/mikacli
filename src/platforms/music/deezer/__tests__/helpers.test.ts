import { describe, expect, test } from "bun:test";

import { buildDeezerEntityUrl, normalizeDeezerUrl, parseDeezerEntityTarget, parseDeezerSearchType } from "../helpers.js";

describe("deezer helpers", () => {
  test("parses deezer entity targets from URLs", () => {
    expect(parseDeezerEntityTarget("https://www.deezer.com/album/302127")).toEqual({
      kind: "album",
      id: 302127,
      url: "https://www.deezer.com/album/302127",
    });
    expect(parseDeezerEntityTarget("https://www.deezer.com/us/track/3135556")).toEqual({
      kind: "track",
      id: 3135556,
      url: "https://www.deezer.com/us/track/3135556",
    });
  });

  test("normalizes deezer urls", () => {
    expect(normalizeDeezerUrl("www.deezer.com/artist/27")).toBe("https://www.deezer.com/artist/27");
  });

  test("formats deezer urls", () => {
    expect(buildDeezerEntityUrl("track", 3135556, "Hello")).toBe("https://www.deezer.com/track/3135556-hello");
  });

  test("parses deezer search types", () => {
    expect(parseDeezerSearchType("playlist")).toBe("playlist");
  });
});
