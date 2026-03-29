import type { AuthStrategyKind } from "../auth/auth-types.js";
import type { PlatformDefinition } from "./platform-definition.js";
import type { AdapterActionResult, Platform, SessionState } from "../../types.js";

export type LoginValidationState = "verified" | "partial" | "deferred";

export interface LoginActionMetadata {
  authType: Exclude<AuthStrategyKind, "none">;
  source?: string;
  status: SessionState;
  validation: LoginValidationState;
  reused: boolean;
  recommendedNextCommand?: string;
  nextCommands?: string[];
}

const AUTH_PRIORITY: ReadonlyArray<Exclude<AuthStrategyKind, "none">> = ["cookies", "session", "apiKey", "botToken", "oauth2"];

const CAPABILITY_PRIORITY = [
  "me",
  "account",
  "profile",
  "repos",
  "projects",
  "spaces",
  "services",
  "apps",
  "zones",
  "boards",
  "teams",
  "tasks",
  "search",
  "posts",
  "orders",
  "cart",
  "status",
] as const;

const CUSTOM_NEXT_CAPABILITIES: Partial<Record<Platform, readonly string[]>> = {
  telegram: ["me", "status", "chats"],
  whatsapp: ["me", "status", "chats"],
};

export function normalizeLoginActionResult(
  result: AdapterActionResult,
  definition?: Pick<PlatformDefinition, "id" | "category" | "commandCategories" | "authStrategies" | "capabilities">,
): AdapterActionResult {
  if (result.action !== "login") {
    return result;
  }

  const existing = readLoginMetadata(result.data?.login);
  const authType = existing?.authType ?? inferAuthType(definition);
  if (!authType) {
    return result;
  }

  const status = existing?.status ?? inferLoginStatus(result);
  const validation = existing?.validation ?? inferValidation(status, result.message);
  const source = existing?.source ?? inferSource(authType);
  const reused = existing?.reused ?? false;
  const nextCommands = uniqueStrings([...(existing?.nextCommands ?? []), ...inferNextCommands(definition)]);
  const recommendedNextCommand = existing?.recommendedNextCommand ?? nextCommands[0];

  return {
    ...result,
    data: {
      ...(result.data ?? {}),
      ...(typeof result.data?.status === "string" ? {} : { status }),
      login: {
        authType,
        source,
        status,
        validation,
        reused,
        ...(recommendedNextCommand ? { recommendedNextCommand } : {}),
        ...(nextCommands.length > 0 ? { nextCommands } : {}),
      } satisfies LoginActionMetadata,
    },
  };
}

function inferAuthType(
  definition?: Pick<PlatformDefinition, "authStrategies">,
): Exclude<AuthStrategyKind, "none"> | undefined {
  if (!definition) {
    return undefined;
  }

  for (const authType of AUTH_PRIORITY) {
    if (definition.authStrategies.includes(authType)) {
      return authType;
    }
  }

  return undefined;
}

function inferLoginStatus(result: AdapterActionResult): SessionState {
  const explicit = result.data?.status;
  if (explicit === "active" || explicit === "expired" || explicit === "unknown") {
    return explicit;
  }

  const message = result.message.toLowerCase();
  if (message.includes("deferred")) {
    return "unknown";
  }
  if (message.includes("partial") || message.includes("limited")) {
    return "unknown";
  }

  return "active";
}

function inferValidation(status: SessionState, message: string): LoginValidationState {
  const lower = message.toLowerCase();
  if (status === "active") {
    return "verified";
  }
  if (lower.includes("deferred")) {
    return "deferred";
  }
  return "partial";
}

function inferSource(authType: Exclude<AuthStrategyKind, "none">): string | undefined {
  switch (authType) {
    case "cookies":
      return "cookies";
    case "apiKey":
      return "token";
    case "botToken":
      return "bot_token";
    case "session":
      return "session";
    case "oauth2":
      return "oauth2";
    default:
      return undefined;
  }
}

function inferNextCommands(
  definition?: Pick<PlatformDefinition, "id" | "category" | "commandCategories" | "capabilities">,
): string[] {
  if (!definition) {
    return [];
  }

  const capabilityIds = definition.capabilities?.map((capability) => capability.id) ?? CUSTOM_NEXT_CAPABILITIES[definition.id] ?? [];
  const prefix = buildCommandPrefix(definition);

  const preferred = CAPABILITY_PRIORITY.find((id) => capabilityIds.includes(id));
  const commands = uniqueStrings([
    preferred ? `${prefix} ${preferred} --json` : "",
    capabilityIds.includes("status") ? `${prefix} status --json` : "",
    `${prefix} capabilities --json`,
  ]);

  return commands;
}

function buildCommandPrefix(definition: Pick<PlatformDefinition, "id" | "category" | "commandCategories">): string {
  const category = definition.commandCategories?.[0] ?? definition.category;
  return `autocli ${category} ${definition.id}`;
}

function readLoginMetadata(value: unknown): LoginActionMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const login = value as Partial<LoginActionMetadata>;
  if (
    login.authType !== "cookies" &&
    login.authType !== "session" &&
    login.authType !== "apiKey" &&
    login.authType !== "botToken" &&
    login.authType !== "oauth2"
  ) {
    return undefined;
  }

  const status = login.status === "active" || login.status === "expired" || login.status === "unknown" ? login.status : "unknown";
  const validation =
    login.validation === "verified" || login.validation === "partial" || login.validation === "deferred"
      ? login.validation
      : "partial";

  return {
    authType: login.authType,
    status,
    validation,
    reused: Boolean(login.reused),
    ...(typeof login.source === "string" && login.source.length > 0 ? { source: login.source } : {}),
    ...(typeof login.recommendedNextCommand === "string" && login.recommendedNextCommand.length > 0
      ? { recommendedNextCommand: login.recommendedNextCommand }
      : {}),
    ...(Array.isArray(login.nextCommands) ? { nextCommands: login.nextCommands.filter((item): item is string => typeof item === "string" && item.length > 0) } : {}),
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || unique.includes(normalized)) {
      continue;
    }
    unique.push(normalized);
  }
  return unique;
}
