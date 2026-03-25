import { describe, expect, test } from "bun:test";

import {
  createEmptyYouTubeMusicControllerState,
  estimateYouTubeMusicPlaybackPositionMs,
  reconcileYouTubeMusicControllerState,
} from "../controller.js";

describe("youtube-music controller", () => {
  test("estimates playback position while playing", () => {
    const state = {
      ...createEmptyYouTubeMusicControllerState(),
      mode: "playing" as const,
      basePositionMs: 12_000,
      startedAt: new Date("2026-03-25T10:00:00.000Z").toISOString(),
    };

    const positionMs = estimateYouTubeMusicPlaybackPositionMs(state, Date.parse("2026-03-25T10:00:03.500Z"));
    expect(positionMs).toBe(15_500);
  });

  test("reconciles dead playback processes back to stopped state", () => {
    const state = {
      ...createEmptyYouTubeMusicControllerState(),
      mode: "playing" as const,
      currentPid: 999_999,
      basePositionMs: 30_000,
      startedAt: new Date("2026-03-25T10:00:00.000Z").toISOString(),
    };

    const reconciled = reconcileYouTubeMusicControllerState(state, Date.parse("2026-03-25T10:00:05.000Z"));
    expect(reconciled.mode).toBe("stopped");
    expect(reconciled.currentPid).toBeUndefined();
    expect(reconciled.startedAt).toBeUndefined();
    expect(reconciled.basePositionMs).toBe(35_000);
  });
});
