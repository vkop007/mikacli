import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";

import { facebookPlatformDefinition } from "../manifest.js";

describe("facebook capability command surface", () => {
  test("exposes a status command for saved-session health checks", () => {
    const command = buildPlatformCommand(facebookPlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));
    const subcommand = byName.get("status");

    expect(subcommand).toBeDefined();
    expect(subcommand!.options.map((option) => option.flags)).toContain("--account <name>");
  });

  test("exposes browser-backed write flags for post, like, and comment", () => {
    const command = buildPlatformCommand(facebookPlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));

    for (const commandName of ["post", "like", "comment"] as const) {
      const subcommand = byName.get(commandName);
      expect(subcommand).toBeDefined();
      expect(subcommand!.options.map((option) => option.flags)).toContain("--browser");
      expect(subcommand!.options.map((option) => option.flags)).toContain("--browser-timeout <seconds>");
    }
  });

  test("uses category-based examples in the manifest", () => {
    const examples = facebookPlatformDefinition.examples ?? [];

    expect(examples.every((example) => example.startsWith("mikacli social facebook"))).toBe(true);
    expect(examples).toContain("mikacli social facebook status");
  });
});
