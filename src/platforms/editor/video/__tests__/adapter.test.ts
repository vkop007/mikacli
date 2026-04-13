import { describe, expect, test } from "bun:test";

import { buildAtempoChain, buildBlurRegionFilter, buildOverlayPosition, buildSpeedVideoFilter, normalizeFrameFormat } from "../adapter.js";

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

  test("builds a blur-region filter with optional time gating", () => {
    expect(
      buildBlurRegionFilter({
        width: 320,
        height: 180,
        x: 100,
        y: 50,
        radius: 18,
        power: 2,
        cornerRadius: 24,
        feather: 3,
        enableExpression: "between(t,5,8.5)",
      }),
    ).toBe(
      "[0:v]split=2[base][region];" +
        "[region]crop=320:180:100:50,boxblur=luma_radius=18:luma_power=2:chroma_radius=18:chroma_power=2," +
        "format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(max(24-X,0)+max(X-(296),0),max(24-Y,0)+max(Y-(156),0)),24),255,0)'," +
        "boxblur=luma_power=0:chroma_power=0:alpha_radius=3:alpha_power=1[blurred];" +
        "[base][blurred]overlay=100:50:enable='between(t,5,8.5)'[v]",
    );

    expect(
      buildBlurRegionFilter({
        width: 120,
        height: 120,
        x: 0,
        y: 0,
        radius: 12,
        power: 1,
      }),
    ).toBe(
      "[0:v]split=2[base][region];" +
        "[region]crop=120:120:0:0,boxblur=luma_radius=12:luma_power=1:chroma_radius=12:chroma_power=1[blurred];" +
        "[base][blurred]overlay=0:0[v]",
    );
  });
});
