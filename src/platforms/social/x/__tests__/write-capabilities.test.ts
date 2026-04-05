import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";

import { xPlatformDefinition } from "../manifest.js";

describe("x write capability command surface", () => {
  test("keeps browser-backed flags on all write commands", () => {
    const command = buildPlatformCommand(xPlatformDefinition);

    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));

    for (const name of ["post", "comment", "like", "unlike"] as const) {
      const subcommand = byName.get(name);
      expect(subcommand).toBeDefined();

      const flags = subcommand!.options.map((option) => option.flags);
      expect(flags).toContain("--browser");
      expect(flags).toContain("--browser-timeout <seconds>");
    }
  });
});
