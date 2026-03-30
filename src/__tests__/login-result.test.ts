import { describe, expect, test } from "bun:test";

import { normalizeActionResult, normalizeLoginActionResult } from "../core/runtime/login-result.js";
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

  test("adds action guidance and list metadata for search-style results", () => {
    const definition = getPlatformDefinition("reddit");
    expect(definition).toBeDefined();

    const result = normalizeActionResult(
      {
        ok: true,
        platform: "reddit",
        account: "public",
        action: "search",
        message: "Loaded Reddit results.",
        data: {
          items: [{ id: "a" }, { id: "b" }],
        },
      },
      definition!,
      "search",
    );

    expect(result.data?.guidance).toEqual({
      recommendedNextCommand: "autocli social reddit profile --json",
      nextCommands: [
        "autocli social reddit profile --json",
        "autocli social reddit capabilities --json",
      ],
      stability: "partial",
    });
    expect(result.data?.meta).toEqual({
      listKey: "items",
      count: 2,
    });
  });

  test("adds stable items and entity aliases for agent-facing result parsing", () => {
    const definition = getPlatformDefinition("tmdb");
    expect(definition).toBeDefined();

    const result = normalizeActionResult(
      {
        ok: true,
        platform: "tmdb",
        account: "public",
        action: "title",
        message: "Loaded title details.",
        data: {
          movie: {
            id: 27205,
            title: "Inception",
          },
          recommendations: [{ id: 157336, title: "Interstellar" }],
        },
      },
      definition!,
      "title",
    );

    expect(result.data?.entity).toEqual({
      id: 27205,
      title: "Inception",
    });
    expect(result.data?.items).toEqual([{ id: 157336, title: "Interstellar" }]);
    expect(result.data?.meta).toEqual({
      listKey: "items",
      count: 1,
    });
    expect(result.data?.guidance).toEqual({
      recommendedNextCommand: "autocli movie tmdb recommendations --json",
      nextCommands: [
        "autocli movie tmdb recommendations --json",
        "autocli movie tmdb capabilities --json",
      ],
      stability: "stable",
    });
  });
});
