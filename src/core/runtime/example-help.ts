import { buildPlatformCommandPrefix } from "./platform-command-prefix.js";
import { resolvePlatformCapabilityMetadata } from "./platform-capability-metadata.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "./platform-definition.js";

const CUSTOM_CAPABILITY_IDS: Partial<Record<PlatformDefinition["id"], readonly string[]>> = {
  calendar: ["auth-url", "login", "status", "me", "calendars", "calendar", "events", "today", "event", "create-event", "update-event", "delete-event"],
  docs: ["auth-url", "login", "status", "me", "documents", "document", "content", "create", "append-text", "replace-text"],
  drive: ["auth-url", "login", "status", "me", "files", "file", "create-folder", "upload", "download", "delete"],
  gmail: ["auth-url", "login", "status", "me", "labels", "messages", "message", "send"],
  sheets: ["auth-url", "login", "status", "me", "create", "spreadsheet", "values", "append", "update", "clear"],
  telegram: ["login", "status", "me", "chats", "history", "send"],
  whatsapp: ["login", "status", "me", "chats", "history", "send"],
  http: ["inspect", "capture", "request", "cookies", "storage", "download", "graphql"],
};

const SAFE_DISCOVERY_COMMANDS = [
  "me",
  "status",
  "account",
  "repos",
  "projects",
  "spaces",
  "services",
  "apps",
  "zones",
  "boards",
  "teams",
  "accounts",
  "organizations",
  "sites",
  "deployments",
  "functions",
  "sources",
  "top",
  "inspect",
  "capabilities",
] as const;

const PLATFORM_CATEGORY_PREFIXES = [
  "llm",
  "editor",
  "finance",
  "data",
  "google",
  "maps",
  "movie",
  "news",
  "music",
  "social",
  "shopping",
  "developer",
  "devops",
  "bot",
  "forum",
  "tools",
] as const;

export function prefixCliExample(example: string, examplePrefix: string | undefined): string {
  if (!examplePrefix) {
    return example;
  }

  const normalized = example.replace(/^autocli\s+/u, "").trim();
  if (PLATFORM_CATEGORY_PREFIXES.some((category) => normalized.startsWith(`${category} `))) {
    return `autocli ${normalized}`;
  }

  const expectedPrefix = `${examplePrefix} `;
  const withoutDuplicatePrefix =
    normalized.startsWith(expectedPrefix) ? normalized.slice(expectedPrefix.length) : normalized;

  return `autocli ${examplePrefix} ${withoutDuplicatePrefix}`.trim();
}

export function buildExamplesHelpText(
  examples: readonly string[],
  options: PlatformCommandBuildOptions = {},
): string {
  if (examples.length === 0) {
    return "";
  }

  return `
Examples:
${examples.map((example) => `  ${prefixCliExample(example, options.examplePrefix)}`).join("\n")}
`;
}

export function buildQuickStartHelpText(
  definition: PlatformDefinition,
  options: PlatformCommandBuildOptions = {},
): string {
  const prefix = buildCommandPrefix(definition, options);
  const capabilityIds = getCapabilityIds(definition);
  const metadata = resolvePlatformCapabilityMetadata(definition);
  const rows: Array<[string, string]> = [["inspect support", `${prefix} capabilities --json`]];

  const loginCommand = buildLoginQuickStartCommand(prefix, capabilityIds, definition, metadata.browserLogin);
  if (loginCommand) {
    rows.push(["sign in", loginCommand]);
  }

  const exampleCommand = buildFirstActionQuickStart(prefix, capabilityIds, definition.examples ?? [], options);
  if (exampleCommand) {
    rows.push(["try this", exampleCommand]);
  }

  rows.push(["show help", `${prefix} --help`]);

  const width = Math.max(...rows.map(([label]) => label.length));
  return `
Quick Start:
${rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`).join("\n")}
`;
}

function buildCommandPrefix(definition: PlatformDefinition, options: PlatformCommandBuildOptions): string {
  return buildPlatformCommandPrefix(definition, options.examplePrefix);
}

function getCapabilityIds(definition: PlatformDefinition): string[] {
  return definition.capabilities?.map((capability) => capability.id) ?? [...(CUSTOM_CAPABILITY_IDS[definition.id] ?? [])];
}

function buildLoginQuickStartCommand(
  prefix: string,
  capabilityIds: readonly string[],
  definition: PlatformDefinition,
  browserLoginSupport: "supported" | "partial" | "unsupported" | "unknown",
): string | undefined {
  if (!capabilityIds.includes("login") || definition.authStrategies.includes("none")) {
    return undefined;
  }

  if (definition.authStrategies.includes("cookies")) {
    return browserLoginSupport === "supported" || browserLoginSupport === "partial"
      ? `${prefix} login --browser`
      : `${prefix} login --cookies ./cookies.json`;
  }

  if (definition.authStrategies.includes("apiKey") || definition.authStrategies.includes("botToken")) {
    return `${prefix} login --token <token>`;
  }

  if (definition.authStrategies.includes("oauth2")) {
    return `${prefix} login --client-id <id> --client-secret <secret>`;
  }

  if (definition.authStrategies.includes("session")) {
    return `${prefix} login`;
  }

  return undefined;
}

function buildFirstActionQuickStart(
  prefix: string,
  capabilityIds: readonly string[],
  examples: readonly string[],
  options: PlatformCommandBuildOptions,
): string | undefined {
  const firstExample = examples.find((example) => {
    const normalized = prefixCliExample(example, options.examplePrefix).trim();
    return !/\slogin(?:\s|$)/u.test(normalized);
  }) ?? examples[0];
  if (firstExample) {
    return prefixCliExample(firstExample, options.examplePrefix);
  }

  const safeCapability = SAFE_DISCOVERY_COMMANDS.find((id) => capabilityIds.includes(id));
  if (!safeCapability) {
    return undefined;
  }

  if (safeCapability === "capabilities") {
    return undefined;
  }

  return `${prefix} ${safeCapability} --json`;
}
