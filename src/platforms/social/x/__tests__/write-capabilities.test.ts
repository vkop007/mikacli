import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";

import { xPlatformDefinition } from "../manifest.js";

describe("x write capability command surface", () => {
  test("exposes a status command for saved-session health checks", () => {
    const command = buildPlatformCommand(xPlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));
    const subcommand = byName.get("status");

    expect(subcommand).toBeDefined();
    expect(subcommand!.options.map((option) => option.flags)).toContain("--account <name>");
  });

  test("keeps browser-backed flags on all write commands", () => {
    const command = buildPlatformCommand(xPlatformDefinition);

    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));

    for (const name of ["post", "comment", "delete", "like", "unlike"] as const) {
      const subcommand = byName.get(name);
      expect(subcommand).toBeDefined();

      const flags = subcommand!.options.map((option) => option.flags);
      expect(flags).toContain("--browser");
      expect(flags).toContain("--browser-timeout <seconds>");
    }
  });
});
