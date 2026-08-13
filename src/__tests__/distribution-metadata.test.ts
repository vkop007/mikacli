import { describe, expect, test } from "bun:test";

import packageJson from "../../package.json" with { type: "json" };
import {
  HEALTH_ENDPOINT_PATH,
  MCP_ENDPOINT_PATH,
  MCP_PROTOCOL_VERSION,
  MIKA_MANAGEMENT_PROTOCOL_VERSION,
  MIKACLI_PACKAGE_NAME,
  MIKACLI_VERSION,
  PLATFORM_CATALOG_SCHEMA_VERSION,
  PLATFORM_STATE_SCHEMA_VERSION,
} from "../integration-metadata.js";
import { NATIVE_TARGETS, getNativeDistributionDescriptor, nativeManifestUrl } from "../native-distribution.js";

describe("npm distribution metadata", () => {
  test("declares a Node-compatible user-facing executable", () => {
    expect(packageJson.name).toBe("@vk007/mikacli");
    expect(packageJson.bin).toEqual({ mikacli: "./dist/index.js" });
    expect(packageJson.engines.node).toBe(">=20.11.0");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.files).toContain("LICENSE");
  });

  test("keeps package, catalog, state, and MCP protocol metadata synchronized", () => {
    expect(MIKACLI_PACKAGE_NAME).toBe(packageJson.name);
    expect(MIKACLI_VERSION).toBe(packageJson.version);
    expect(packageJson.mikacli.schemaVersion).toBe(1);
    expect(packageJson.mikacli.developerCli.executable).toBe("mikacli");
    expect(packageJson.mikacli.managedDistribution.requiresNode).toBe(false);
    expect(packageJson.mikacli.managedDistribution.format).toBe("standalone-executable");
    expect(packageJson.mikacli.managedDistribution.manifestUrl).toBe(nativeManifestUrl());
    expect(packageJson.mikacli.catalog.schemaVersion).toBe(PLATFORM_CATALOG_SCHEMA_VERSION);
    expect(packageJson.mikacli.catalog.stateSchemaVersion).toBe(PLATFORM_STATE_SCHEMA_VERSION);
    expect(packageJson.mikacli.mcp.endpoint).toBe(MCP_ENDPOINT_PATH);
    expect(packageJson.mikacli.mcp.healthEndpoint).toBe(HEALTH_ENDPOINT_PATH);
    expect(packageJson.mikacli.mcp.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(packageJson.mikacli.mcp.managementProtocolVersion).toBe(MIKA_MANAGEMENT_PROTOCOL_VERSION);
  });

  test("publishes a standalone target contract for macOS, Linux, and Windows", () => {
    expect(NATIVE_TARGETS.map((target) => target.id)).toEqual([
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "windows-x64",
    ]);
    const descriptor = getNativeDistributionDescriptor() as {
      requiresNode: boolean;
      manifestUrl: string;
      targets: Array<{ executableUrl: string; npmTarballUrl: string; checksumSource: string }>;
    };
    expect(descriptor.requiresNode).toBe(false);
    expect(descriptor.manifestUrl).toContain(MIKACLI_VERSION);
    expect(descriptor.targets).toHaveLength(5);
    expect(descriptor.targets.every((target) => target.executableUrl.startsWith("https://"))).toBe(true);
    expect(descriptor.targets.every((target) => target.npmTarballUrl.startsWith("https://"))).toBe(true);
    expect(descriptor.targets.every((target) => target.checksumSource === descriptor.manifestUrl)).toBe(true);
  });
});
