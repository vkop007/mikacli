import { describe, expect, it } from "bun:test";

import { extractLinearIssueKey, normalizeLinearAccountName, normalizeLinearReference } from "../platforms/developer/linear/helpers.js";

describe("linear helpers", () => {
  it("sanitizes account names", () => {
    expect(normalizeLinearAccountName("  Work Team  ")).toBe("work-team");
  });

  it("normalizes references without changing keys", () => {
    expect(normalizeLinearReference(" ENG-123 ")).toBe("ENG-123");
  });

  it("extracts issue keys from URLs", () => {
    expect(extractLinearIssueKey("https://linear.app/acme/issue/ENG-123/fix-login-flow")).toBe("ENG-123");
  });
});
