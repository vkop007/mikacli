import { describe, expect, test } from "bun:test";

import { emitInteractiveProgress, setInteractiveProgressHandler } from "../utils/interactive-progress.js";

describe("interactive progress", () => {
  test("emits to the active handler when one is registered", () => {
    let received = "";
    setInteractiveProgressHandler((message) => {
      received = message;
    });

    expect(emitInteractiveProgress("Browser opened.")).toBe(true);
    expect(received).toBe("Browser opened.");

    setInteractiveProgressHandler(null);
  });

  test("returns false when no handler is registered", () => {
    setInteractiveProgressHandler(null);
    expect(emitInteractiveProgress("Waiting...")).toBe(false);
  });
});
