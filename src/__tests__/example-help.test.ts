import { describe, expect, test } from "bun:test";

import { prefixCliExample } from "../core/runtime/example-help.js";

describe("example help prefixing", () => {
  test("prefixes flat examples once", () => {
    expect(prefixCliExample("autocli confluence me", "developer")).toBe("autocli developer confluence me");
  });

  test("does not duplicate an existing category prefix", () => {
    expect(prefixCliExample("autocli developer confluence me", "developer")).toBe("autocli developer confluence me");
  });
});
