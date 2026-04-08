import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";

import { twitchPlatformDefinition } from "../manifest.js";

describe("twitch capability command surface", () => {
  test("exposes the expected Twitch read commands", () => {
    const command = buildPlatformCommand(twitchPlatformDefinition);
    const byName = new Map(command.commands.map((entry) => [entry.name(), entry]));

    expect(byName.get("status")).toBeDefined();
    expect(byName.get("me")).toBeDefined();
    expect(byName.get("search")).toBeDefined();
    expect(byName.get("channel")).toBeDefined();
    expect(byName.get("stream")).toBeDefined();
    expect(byName.get("videos")).toBeDefined();
    expect(byName.get("clips")).toBeDefined();
    expect(byName.get("channel")!.aliases()).toContain("user");
    expect(byName.get("stream")!.aliases()).toContain("live");
    expect(byName.get("videos")!.aliases()).toContain("vods");
    expect(byName.get("clips")!.options.map((option) => option.flags)).toContain("--period <window>");
  });

  test("uses category-based examples in the manifest", () => {
    const examples = twitchPlatformDefinition.examples ?? [];

    expect(examples.every((example) => example.startsWith("autocli social twitch"))).toBe(true);
    expect(examples).toContain("autocli social twitch me");
  });
});
