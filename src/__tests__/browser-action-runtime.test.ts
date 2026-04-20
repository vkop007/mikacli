import { describe, expect, test } from "bun:test";

import { MikaCliError } from "../errors.js";
import {
  normalizeBrowserActionRuntimeError,
  resolveBrowserActionStrategySteps,
  withBrowserActionMetadata,
} from "../core/runtime/browser-action-runtime.js";
import type { AdapterActionResult } from "../types.js";

describe("browser action runtime", () => {
  test("maps declarative presets into runtime steps", () => {
    expect(resolveBrowserActionStrategySteps("headless-only")).toEqual([{ source: "headless" }]);
    expect(resolveBrowserActionStrategySteps("headless-then-shared", "Open shared browser")).toEqual([
      { source: "headless" },
      { source: "shared", announceLabel: "Open shared browser" },
    ]);
    expect(resolveBrowserActionStrategySteps("headless-then-profile-then-shared", "Reuse shared browser")).toEqual([
      { source: "headless" },
      { source: "profile" },
      { source: "shared", announceLabel: "Reuse shared browser" },
    ]);
  });

  test("attaches standardized browser metadata to adapter results", () => {
    const baseResult: AdapterActionResult = {
        ok: true,
        platform: "x",
        account: "default",
        action: "post",
        message: "Posted.",
      };
    const result = withBrowserActionMetadata(
      baseResult,
      {
        value: { tweetId: "1" },
        browser: {
          runtime: "browser",
          mode: "fallback",
          source: "headless",
          strategy: "headless-then-shared",
          targetUrl: "https://x.com/compose/post",
          timeoutSeconds: 60,
        },
      },
      {
        text: "Hello",
      },
    );

    expect(result.data).toEqual({
      text: "Hello",
      source: "headless",
      browser: {
        runtime: "browser",
        mode: "fallback",
        source: "headless",
        strategy: "headless-then-shared",
        targetUrl: "https://x.com/compose/post",
        timeoutSeconds: 60,
      },
    });
  });

  test("normalizes missing shared-browser failures into a first-class browser action error", () => {
    const error = normalizeBrowserActionRuntimeError(
      {
        platform: "linkedin",
        action: "post-media",
        actionLabel: "media publish",
        targetUrl: "https://www.linkedin.com/feed/",
        actionFn: async () => ({ ok: true }),
      },
      new MikaCliError("BROWSER_NOT_RUNNING", "No shared browser profile is open.", {
        details: {
          profile: "default",
        },
      }),
    );

    expect(error).toBeInstanceOf(MikaCliError);
    expect((error as MikaCliError).code).toBe("BROWSER_ACTION_SHARED_REQUIRED");
    expect((error as MikaCliError).message).toContain("LinkedIn media publish requires the shared MikaCLI browser");
  });
});
