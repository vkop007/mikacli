import { describe, expect, test } from "bun:test";

import { buildAtempoChain, buildOverlayPosition, buildSpeedVideoFilter, normalizeFrameFormat } from "../adapter.js";

describe("video editor helper filters", () => {
  test("builds chained atempo filters for speed changes", () => {
    expect(buildAtempoChain(0.25)).toBe("atempo=0.5,atempo=0.5");
    expect(buildAtempoChain(1.5)).toBe("atempo=1.5");
    expect(buildAtempoChain(4)).toBe("atempo=2,atempo=2");
  });

  test("builds video speed and overlay positions", () => {
    expect(buildSpeedVideoFilter(2)).toBe("setpts=0.5*PTS");
    expect(buildOverlayPosition("top-left", 12)).toBe("12:12");
    expect(buildOverlayPosition("bottom-right", 16)).toBe("main_w-overlay_w-16:main_h-overlay_h-16");
  });

  test("normalizes frame extraction formats", () => {
    expect(normalizeFrameFormat("PNG")).toBe("png");
    expect(normalizeFrameFormat("jpeg")).toBe("jpeg");
    expect(() => normalizeFrameFormat("gif")).toThrow();
  });
});
