import packageJson from "../package.json" with { type: "json" };
import { IS_MIKACLI_STANDALONE } from "./build-flags.js";
import { getNativeDistributionDescriptor } from "./native-distribution.js";

export const MIKACLI_PACKAGE_NAME = packageJson.name;
export const MIKACLI_VERSION = packageJson.version;
export const MIKACLI_EXECUTABLE = "mikacli";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MIKA_MANAGEMENT_PROTOCOL_VERSION = "1.0";
export const PLATFORM_CATALOG_SCHEMA_VERSION = 1 as const;
export const PLATFORM_STATE_SCHEMA_VERSION = 1 as const;

export const MCP_ENDPOINT_PATH = "/mcp";
export const HEALTH_ENDPOINT_PATH = "/health";

export function getIntegrationMetadata(platformCount: number): Record<string, unknown> {
  return {
    distribution: {
      package: MIKACLI_PACKAGE_NAME,
      version: MIKACLI_VERSION,
      executable: MIKACLI_EXECUTABLE,
      channel: "npm",
      currentRuntime: IS_MIKACLI_STANDALONE ? "standalone-executable" : "node-development-cli",
      stateDirectoryEnvironmentVariable: "MIKACLI_HOME",
    },
    managedDistribution: getNativeDistributionDescriptor(MIKACLI_VERSION),
    catalog: {
      schemaVersion: PLATFORM_CATALOG_SCHEMA_VERSION,
      revision: MIKACLI_VERSION,
      providerCount: platformCount,
      discovery: "dynamic-registry",
      stateSchemaVersion: PLATFORM_STATE_SCHEMA_VERSION,
    },
    mcp: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      managementProtocolVersion: MIKA_MANAGEMENT_PROTOCOL_VERSION,
      transport: "streamable-http",
      endpoint: MCP_ENDPOINT_PATH,
      healthEndpoint: HEALTH_ENDPOINT_PATH,
    },
  };
}
