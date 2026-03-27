import { describe, expect, test } from "bun:test";

import { normalizeGifVideoFormat } from "../adapter.js";

describe("gif editor", () => {
  test("normalizes supported video formats", () => {
    expect(normalizeGifVideoFormat("MP4")).toBe("mp4");
    expect(normalizeGifVideoFormat("webm")).toBe("webm");
  });

  test("rejects unsupported video formats", () => {
    expect(() => normalizeGifVideoFormat("avi")).toThrow();
  });
});
