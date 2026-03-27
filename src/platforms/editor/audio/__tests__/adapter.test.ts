import { describe, expect, test } from "bun:test";

import { audioEditorAdapter } from "../adapter.js";

describe("audio editor", () => {
  test("rejects invalid format names", () => {
    return expect(
      audioEditorAdapter.convert({
        inputPath: "/tmp/input.mp3",
        to: "not-a-format",
      }),
    ).rejects.toThrow();
  });
});
