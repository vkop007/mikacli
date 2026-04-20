import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";

import { instagramPlatformDefinition } from "../manifest.js";

describe("instagram capability command surface", () => {
  test("exposes a status command for saved-session health checks", () => {
    const command = buildPlatformCommand(instagramPlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));
    const subcommand = byName.get("status");

    expect(subcommand).toBeDefined();
    expect(subcommand!.options.map((option) => option.flags)).toContain("--account <name>");
  });

  test("uses category-based examples in the manifest", () => {
    const examples = instagramPlatformDefinition.examples ?? [];

    expect(examples.every((example) => example.startsWith("mikacli social instagram") || example.startsWith("mikacli tools download"))).toBe(true);
    expect(examples).toContain("mikacli social instagram status");
  });

  test("exposes delete and delete-comment commands for cleanup flows", () => {
    const command = buildPlatformCommand(instagramPlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));

    const deleteCommand = byName.get("delete");
    expect(deleteCommand).toBeDefined();
    expect(deleteCommand!.aliases()).toContain("remove");
    expect(deleteCommand!.options.map((option) => option.flags)).toContain("--browser");
    expect(deleteCommand!.options.map((option) => option.flags)).toContain("--browser-timeout <seconds>");

    const deleteCommentCommand = byName.get("delete-comment");
    expect(deleteCommentCommand).toBeDefined();
    expect(deleteCommentCommand!.aliases()).toContain("remove-comment");
    expect(deleteCommentCommand!.options.map((option) => option.flags)).toContain("--account <name>");
    expect(deleteCommentCommand!.options.map((option) => option.flags)).toContain("--browser");
    expect(deleteCommentCommand!.options.map((option) => option.flags)).toContain("--browser-timeout <seconds>");
  });
});
