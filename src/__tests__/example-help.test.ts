import { describe, expect, test } from "bun:test";

import { prefixCliExample } from "../core/runtime/example-help.js";

describe("example help prefixing", () => {
  test("prefixes flat examples once", () => {
    expect(prefixCliExample("mikacli confluence me", "developer")).toBe("mikacli developer confluence me");
  });

  test("does not duplicate an existing category prefix", () => {
    expect(prefixCliExample("mikacli developer confluence me", "developer")).toBe("mikacli developer confluence me");
  });
});
