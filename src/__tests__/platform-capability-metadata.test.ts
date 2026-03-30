import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { buildQuickStartHelpText } from "../core/runtime/example-help.js";
import {
  buildCapabilityMetadataHelpText,
  buildStabilityGuideHelpText,
  resolvePlatformCapabilityMetadata,
} from "../core/runtime/platform-capability-metadata.js";
import { getPlatformDefinition } from "../platforms/index.js";

describe("platform capability metadata", () => {
  test("resolves strong metadata for github", () => {
    const definition = getPlatformDefinition("github");
    expect(definition).toBeDefined();

    const metadata = resolvePlatformCapabilityMetadata(definition!);
    expect(metadata.auth).toEqual(["cookies"]);
    expect(metadata.discovery).toBe("supported");
    expect(metadata.mutation).toBe("supported");
    expect(metadata.browserLogin).toBe("supported");
    expect(metadata.stability).toBe("stable");
  });

  test("resolves conservative metadata for news", () => {
    const definition = getPlatformDefinition("news");
    expect(definition).toBeDefined();

    const metadata = resolvePlatformCapabilityMetadata(definition!);
    expect(metadata.auth).toEqual(["none"]);
    expect(metadata.discovery).toBe("supported");
    expect(metadata.mutation).toBe("unsupported");
    expect(metadata.browserLogin).toBe("unsupported");
    expect(metadata.stability).toBe("stable");
  });

  test("adds generated capabilities command to capability-driven and custom-built providers", () => {
    const githubCommand = buildPlatformCommand(getPlatformDefinition("github")!);
    const httpCommand = buildPlatformCommand(getPlatformDefinition("http")!);

    expect(githubCommand.commands.map((command) => command.name())).toContain("capabilities");
    expect(httpCommand.commands.map((command) => command.name())).toContain("capabilities");
  });

  test("adds shared quick-start and stability help text", () => {
    const githubHelp = buildQuickStartHelpText(getPlatformDefinition("github")!, { examplePrefix: "developer" });
    const newsSupportHelp = buildCapabilityMetadataHelpText(getPlatformDefinition("news")!);
    const stabilityGuide = buildStabilityGuideHelpText();

    expect(githubHelp).toContain("Quick Start:");
    expect(githubHelp).toContain("autocli developer github login --browser");
    expect(newsSupportHelp).toContain("Support Profile:");
    expect(stabilityGuide).toContain("Stability Guide:");

    expect(newsSupportHelp).toContain("autocli news capabilities --json");
    expect(githubHelp).not.toContain("autocli news login");
  });
});
