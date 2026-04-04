import { describe, expect, test } from "bun:test";

import { AutoCliError } from "../errors.js";
import { resolveErrorRecovery, serializeCliError } from "../utils/error-recovery.js";

describe("error recovery guidance", () => {
  test("suggests the provider login command for missing saved sessions", () => {
    const serialized = serializeCliError(
      new AutoCliError("SESSION_NOT_FOUND", "No saved X session found.", {
        details: {
          platform: "x",
        },
      }),
    );

    expect(serialized.error.nextCommand).toBe("autocli social x login");
    expect(serialized.error.hint).toContain("Refresh or create the saved provider session");
  });

  test("infers the provider from provider-specific session expiry codes", () => {
    const recovery = resolveErrorRecovery(
      new AutoCliError("QWEN_SESSION_EXPIRED", "Qwen session expired. Re-import cookies and token."),
    );

    expect(recovery.nextCommand).toBe("autocli llm qwen login");
  });

  test("suggests provider login when a shared browser session is required", () => {
    const recovery = resolveErrorRecovery(
      new AutoCliError("BROWSER_ACTION_SHARED_REQUIRED", "LinkedIn post requires the shared browser.", {
        details: {
          platform: "linkedin",
          action: "post-media",
        },
      }),
    );

    expect(recovery.nextCommand).toBe("autocli social linkedin login");
    expect(recovery.hint).toContain("shared browser session");
  });

  test("adds a browser retry hint for anti-bot style blocks", () => {
    const recovery = resolveErrorRecovery(
      new AutoCliError("GROK_ANTI_BOT_BLOCKED", "Grok rejected the browserless request.", {
        details: {
          platform: "grok",
          action: "text",
        },
      }),
    );

    expect(recovery.hint).toContain("--browser");
    expect(recovery.nextCommand).toBeUndefined();
  });

  test("suggests a longer browser timeout for login timeout errors", () => {
    const recovery = resolveErrorRecovery(
      new AutoCliError("BROWSER_LOGIN_TIMEOUT", "Timed out waiting for X browser login.", {
        details: {
          platform: "x",
        },
      }),
    );

    expect(recovery.nextCommand).toBe("autocli social x login --browser-timeout 300");
  });
});
