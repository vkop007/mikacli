import { describe, expect, test } from "bun:test";

import {
  parseSpotifyBooleanState,
  parseSpotifyEngineOption,
  parseSpotifyPercentValue,
  parseSpotifyPositionValue,
  parseSpotifyRepeatState,
} from "../options.js";

describe("spotify options", () => {
  test("parses boolean playback states", () => {
    expect(parseSpotifyBooleanState("on")).toBe(true);
    expect(parseSpotifyBooleanState("false")).toBe(false);
  });

  test("parses volume percent values", () => {
    expect(parseSpotifyPercentValue("75")).toBe(75);
  });

  test("parses position strings", () => {
    expect(parseSpotifyPositionValue("90000")).toBe(90000);
    expect(parseSpotifyPositionValue("1:30")).toBe(90000);
    expect(parseSpotifyPositionValue("1:01:30")).toBe(3690000);
  });

  test("parses repeat states", () => {
    expect(parseSpotifyRepeatState("track")).toBe("track");
    expect(parseSpotifyRepeatState("off")).toBe("off");
  });

  test("parses engine states", () => {
    expect(parseSpotifyEngineOption("auto")).toBe("auto");
    expect(parseSpotifyEngineOption("connect")).toBe("connect");
    expect(parseSpotifyEngineOption("web")).toBe("web");
  });
});
