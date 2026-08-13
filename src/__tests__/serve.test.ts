import { describe, expect, test } from "bun:test";

import {
  TOOLS,
  commandPath,
  describePlatform,
  isMetadataSubcommand,
  listPlatforms,
  toCliArguments,
} from "../commands/serve.js";
import { getPlatformDefinition, getPlatformDefinitions } from "../platforms/index.js";

describe("MCP tool surface", () => {
  test("stays at four tools no matter how large the catalog grows", () => {
    // The whole design rests on this: a client carrying one tool per capability
    // would hold ~960 of them, an order of magnitude past what MCP clients
    // budget for. If this number ever climbs, discovery has leaked into
    // declaration.
    expect(TOOLS.length).toBe(4);
    expect(TOOLS.map((tool) => tool.name).sort()).toEqual([
      "mika_auth_status",
      "mika_describe",
      "mika_list_platforms",
      "mika_run",
    ]);
  });

  test("only mika_list_platforms is callable with no arguments", () => {
    // It is the entry point, so it has to work before the caller knows any
    // platform name.
    const entry = TOOLS.find((tool) => tool.name === "mika_list_platforms");
    expect(entry?.inputSchema.required).toEqual([]);
  });
});

describe("command paths", () => {
  test("always route through the category", () => {
    // Top-level provider commands are refused by the CLI, so a path that omits
    // the category fails at run time with a confusing message.
    const dns = getPlatformDefinition("dns" as never);
    expect(dns).toBeDefined();
    expect(commandPath(dns!)).toEqual(["tools", "dns"]);

    const linear = getPlatformDefinition("linear" as never);
    expect(commandPath(linear!)).toEqual(["developer", "linear"]);
  });

  test("the free metadata subcommand is not mistaken for a capability", () => {
    expect(isMetadataSubcommand("capabilities")).toBe(true);
    expect(isMetadataSubcommand("caps")).toBe(true);
    expect(isMetadataSubcommand("issues")).toBe(false);
  });
});

describe("describePlatform", () => {
  test("reports the subcommand shape with per-capability schemas", () => {
    const linear = getPlatformDefinition("linear" as never);
    const described = describePlatform(linear!) as {
      invocation: string;
      capabilities: Array<{ name: string; arguments: { properties: Record<string, unknown> } }>;
    };

    expect(described.invocation).toBe("subcommand");
    expect(described.capabilities.length).toBeGreaterThan(5);
    expect(described.capabilities.some((c) => c.name === "issues")).toBe(true);
    // `capabilities` is registered on every platform for free and would
    // otherwise show up as a callable action.
    expect(described.capabilities.some((c) => c.name === "capabilities")).toBe(false);
  });

  test("reports the direct shape, where the platform is itself the action", () => {
    // `mikacli tools dns openai.com --type MX` has no capability segment. A
    // caller told only "no capabilities" would conclude the platform is broken.
    const dns = getPlatformDefinition("dns" as never);
    const described = describePlatform(dns!) as {
      invocation: string;
      capabilities: unknown[];
      arguments: { properties: Record<string, unknown> };
    };

    expect(described.invocation).toBe("direct");
    expect(described.capabilities).toEqual([]);
    expect(described.arguments.properties).toHaveProperty("_");
    expect(described.arguments.properties).toHaveProperty("type");
  });

  test("never advertises the help flag as an argument", () => {
    const image = getPlatformDefinition("image" as never);
    const described = describePlatform(image!) as {
      capabilities: Array<{ arguments: { properties: Record<string, unknown> } }>;
    };
    for (const capability of described.capabilities) {
      expect(capability.arguments.properties).not.toHaveProperty("help");
    }
  });
});

describe("listPlatforms", () => {
  test("returns every platform when unfiltered", () => {
    const listed = listPlatforms() as { total: number };
    expect(listed.total).toBe(getPlatformDefinitions().length);
  });

  test("marks credential-free platforms, which are the majority", () => {
    const free = listPlatforms(undefined, "none") as {
      total: number;
      platforms: Array<{ needsCredential: boolean }>;
    };
    // More than half the catalog works with no sign-in at all. That is the
    // reason to surface this filter rather than making callers infer it.
    expect(free.total).toBeGreaterThan(getPlatformDefinitions().length / 2);
    expect(free.platforms.every((entry) => entry.needsCredential === false)).toBe(true);
  });

  test("filters by category", () => {
    const developer = listPlatforms("developer") as {
      platforms: Array<{ platform: string; category: string }>;
    };
    expect(developer.platforms.every((entry) => entry.category === "developer")).toBe(true);
    expect(developer.platforms.some((entry) => entry.platform === "linear")).toBe(true);
  });
});

describe("toCliArguments", () => {
  test("expands positional arguments in order, before named ones", () => {
    expect(toCliArguments({ _: ["openai.com"], type: "MX" })).toEqual([
      "openai.com",
      "--type",
      "MX",
    ]);
  });

  test("emits a boolean flag only when true", () => {
    expect(toCliArguments({ refresh: true })).toEqual(["--refresh"]);
    expect(toCliArguments({ refresh: false })).toEqual([]);
  });

  test("converts camelCase back to the kebab flag Commander declared", () => {
    expect(toCliArguments({ maxResults: "20" })).toEqual(["--max-results", "20"]);
  });

  test("drops null and undefined rather than passing empty flags", () => {
    // A model that omits an optional field often sends null for it; forwarding
    // `--team null` would reach the provider as a real value.
    expect(toCliArguments({ team: null, title: undefined, body: "x" })).toEqual(["--body", "x"]);
  });

  test("handles no arguments at all", () => {
    expect(toCliArguments(undefined)).toEqual([]);
    expect(toCliArguments({})).toEqual([]);
  });
});
