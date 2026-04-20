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
        account: "example-user",
        action: "login",
        message: "Saved GitHub web session for example-user.",
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
      recommendedNextCommand: "mikacli developer github me --json",
      nextCommands: [
        "mikacli developer github me --json",
        "mikacli developer github status --json",
        "mikacli developer github capabilities --json",
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
      recommendedNextCommand: "mikacli social telegram me --json",
      nextCommands: [
        "mikacli social telegram me --json",
        "mikacli social telegram status --json",
        "mikacli social telegram capabilities --json",
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
      recommendedNextCommand: "mikacli social reddit profile --json",
      nextCommands: [
        "mikacli social reddit profile --json",
        "mikacli social reddit capabilities --json",
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
      recommendedNextCommand: "mikacli movie tmdb recommendations --json",
      nextCommands: [
        "mikacli movie tmdb recommendations --json",
        "mikacli movie tmdb capabilities --json",
      ],
      stability: "stable",
    });
  });
});
