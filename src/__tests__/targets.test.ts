import { describe, expect, test } from "bun:test";

import { parseYouTubeTarget } from "../utils/targets.js";

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
