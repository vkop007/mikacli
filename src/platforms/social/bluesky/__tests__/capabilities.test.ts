import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";
import { blueskyPlatformDefinition } from "../manifest.js";

describe("bluesky capability command surface", () => {
  test("exposes login, status, me, and write commands", () => {
    const command = buildPlatformCommand(blueskyPlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));

    for (const commandName of ["login", "status", "me", "post", "comment", "like"] as const) {
      expect(byName.get(commandName)).toBeDefined();
    }

    expect(byName.get("login")!.options.map((option) => option.flags)).toContain("--handle <value>");
    expect(byName.get("login")!.options.map((option) => option.flags)).toContain("--app-password <value>");
  });

  test("uses category-based examples in the manifest", () => {
    const examples = blueskyPlatformDefinition.examples ?? [];

    expect(examples.every((example) => example.startsWith("mikacli social bluesky"))).toBe(true);
    expect(examples).toContain("mikacli social bluesky me");
  });
});
