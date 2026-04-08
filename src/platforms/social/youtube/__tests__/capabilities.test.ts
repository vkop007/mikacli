import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";

import { youtubePlatformDefinition } from "../manifest.js";

describe("youtube capability command surface", () => {
  test("exposes a status command for saved-session health checks", () => {
    const command = buildPlatformCommand(youtubePlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));
    const subcommand = byName.get("status");

    expect(subcommand).toBeDefined();
    expect(subcommand!.options.map((option) => option.flags)).toContain("--account <name>");
  });

  test("exposes a browser-backed post command with timeout control", () => {
    const command = buildPlatformCommand(youtubePlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));
    const subcommand = byName.get("post");

    expect(subcommand).toBeDefined();
    expect(subcommand!.description()).toContain("community");
    expect(subcommand!.options.map((option) => option.flags)).toContain("--image <path>");
    expect(subcommand!.options.map((option) => option.flags)).toContain("--browser");
    expect(subcommand!.options.map((option) => option.flags)).toContain("--browser-timeout <seconds>");
  });

  test("exposes a browser-backed delete command for community posts", () => {
    const command = buildPlatformCommand(youtubePlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));
    const subcommand = byName.get("delete");

    expect(subcommand).toBeDefined();
    expect(subcommand!.description()).toContain("community post");
    expect(subcommand!.aliases()).toContain("remove");
    expect(subcommand!.options.map((option) => option.flags)).toContain("--browser");
    expect(subcommand!.options.map((option) => option.flags)).toContain("--browser-timeout <seconds>");
  });
});
