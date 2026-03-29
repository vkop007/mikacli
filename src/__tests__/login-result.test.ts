import { describe, expect, test } from "bun:test";

import { normalizeLoginActionResult } from "../core/runtime/login-result.js";
import { getPlatformDefinition } from "../platforms/index.js";

describe("login result normalization", () => {
  test("adds standardized login metadata and next commands for github", () => {
    const definition = getPlatformDefinition("github");
    expect(definition).toBeDefined();

    const result = normalizeLoginActionResult(
      {
        ok: true,
        platform: "github",
        account: "vkop007",
        action: "login",
        message: "Saved GitHub web session for vkop007.",
        data: {
          status: "active",
        },
      },
      definition!,
    );

    expect(result.data?.login).toEqual({
      authType: "cookies",
      source: "cookies",
      status: "active",
      validation: "verified",
      reused: false,
      recommendedNextCommand: "autocli developer github me --json",
      nextCommands: [
        "autocli developer github me --json",
        "autocli developer github capabilities --json",
      ],
    });
  });

  test("uses custom next commands for telegram build-command providers", () => {
    const definition = getPlatformDefinition("telegram");
    expect(definition).toBeDefined();

    const result = normalizeLoginActionResult(
      {
        ok: true,
        platform: "telegram",
        account: "default",
        action: "login",
        message: "Saved Telegram session for default.",
      },
      definition!,
    );

    expect(result.data?.login).toEqual({
      authType: "session",
      source: "session",
      status: "active",
      validation: "verified",
      reused: false,
      recommendedNextCommand: "autocli social telegram me --json",
      nextCommands: [
        "autocli social telegram me --json",
        "autocli social telegram status --json",
        "autocli social telegram capabilities --json",
      ],
    });
  });
});
