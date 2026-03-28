import { describe, expect, test } from "bun:test";

import { looksLikeTimezone } from "../adapter.js";

describe("timezone adapter helpers", () => {
  test("detects common IANA timezone identifiers", () => {
    expect(looksLikeTimezone("Asia/Kolkata")).toBe(true);
    expect(looksLikeTimezone("America/New_York")).toBe(true);
    expect(looksLikeTimezone("UTC")).toBe(true);
  });

  test("does not treat plain places as timezone identifiers", () => {
    expect(looksLikeTimezone("Mumbai")).toBe(false);
    expect(looksLikeTimezone("New York")).toBe(false);
  });
});
