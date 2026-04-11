import type { AuthStrategyKind } from "../auth/auth-types.js";
import type { PlatformDefinition } from "./platform-definition.js";
import { buildPlatformCommandPrefix } from "./platform-command-prefix.js";
import { resolvePlatformCapabilityMetadata } from "./platform-capability-metadata.js";
import type { AdapterActionResult, Platform, SessionState } from "../../types.js";
import type { PlatformStability } from "./platform-definition.js";

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

export interface ActionGuidanceMetadata {
  recommendedNextCommand?: string;
  nextCommands?: string[];
  stability?: PlatformStability;
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

const CUSTOM_CAPABILITY_IDS: Partial<Record<Platform, readonly string[]>> = {
  calendar: ["auth-url", "login", "status", "me", "calendars", "calendar", "events", "today", "event", "create-event", "update-event", "delete-event"],
  docs: ["auth-url", "login", "status", "me", "documents", "document", "content", "create", "append-text", "replace-text"],
  drive: ["auth-url", "login", "status", "me", "files", "file", "create-folder", "upload", "download", "delete"],
  gmail: ["auth-url", "login", "status", "me", "labels", "messages", "message", "send"],
  sheets: ["auth-url", "login", "status", "me", "create", "spreadsheet", "values", "append", "update", "clear"],
  telegram: ["login", "status", "me", "chats", "history", "send"],
  whatsapp: ["login", "status", "me", "chats", "history", "send"],
  http: ["inspect", "capture", "request", "cookies", "storage", "download", "graphql"],
};

const ACTION_FOLLOW_UPS: Partial<Record<string, readonly string[]>> = {
  login: ["me", "account", "profile", "status"],
  status: ["me", "account", "profile", "projects", "repos", "posts"],
  me: ["projects", "repos", "spaces", "boards", "teams", "posts", "status"],
  account: ["projects", "repos", "spaces", "boards", "teams", "status"],
  profile: ["posts", "thread", "me", "status"],
  posts: ["thread", "profile", "status"],
  search: ["title", "profile", "track", "album", "product", "page", "thread", "posts"],
  top: ["search", "title", "feed"],
  title: ["recommendations", "episodes", "availability", "thread"],
  inspect: ["cookies", "storage", "capture", "request"],
  capture: ["inspect", "cookies", "storage", "request"],
  request: ["inspect", "cookies", "storage", "capture"],
  graphql: ["inspect", "storage", "request"],
  cookies: ["inspect", "request"],
  storage: ["inspect", "request"],
  download: ["inspect", "request"],
};

const META_EXCLUDED_KEYS = new Set(["guidance", "login", "meta", "candidates", "requests", "cookies", "localStorage", "sessionStorage"]);
const LIST_ALIAS_KEYS = [
  "items",
  "results",
  "posts",
  "recommendations",
  "tracks",
  "albums",
  "products",
  "pages",
  "repos",
  "projects",
  "issues",
  "pulls",
  "mergeRequests",
  "releases",
  "boards",
  "lists",
  "cards",
  "calendars",
  "documents",
  "services",
  "zones",
  "functions",
  "organizations",
  "accounts",
  "sites",
  "deployments",
  "teams",
  "tasks",
  "chats",
  "messages",
  "events",
  "episodes",
  "spaces",
  "children",
  "domains",
  "machines",
  "volumes",
  "certificates",
  "apps",
  "playlists",
  "artists",
  "comments",
  "monitors",
  "incidents",
  "integrations",
  "alertContacts",
  "allAlertContacts",
  "incidentComments",
  "monitorGroups",
  "maintenanceWindows",
  "psps",
  "announcements",
  "tags",
  "incidentAlerts",
  "followers",
  "following",
  "stories",
] as const;
const ENTITY_ALIAS_KEYS = [
  "entity",
  "profile",
  "target",
  "item",
  "page",
  "project",
  "repo",
  "issue",
  "pull",
  "mergeRequest",
  "product",
  "order",
  "track",
  "album",
  "artist",
  "playlist",
  "movie",
  "show",
  "title",
  "post",
  "event",
  "document",
  "thread",
  "site",
  "service",
  "app",
  "zone",
  "board",
  "calendar",
  "card",
  "list",
  "monitor",
  "incident",
  "integration",
  "incidentComment",
  "monitorGroup",
  "maintenanceWindow",
  "psp",
  "announcement",
  "team",
  "space",
  "organization",
  "account",
  "deployment",
  "function",
  "machine",
  "volume",
  "certificate",
] as const;

export function normalizeActionResult(
  result: AdapterActionResult,
  definition?: Pick<PlatformDefinition, "id" | "category" | "commandCategories" | "authStrategies" | "capabilities">,
  actionId?: string,
): AdapterActionResult {
  const normalizedLogin = result.action === "login" ? normalizeLoginActionResult(result, definition) : result;
  const normalizedData = normalizeResultDataShape(normalizedLogin.data);
  if (!definition) {
    return {
      ...normalizedLogin,
      ...(normalizedData ? { data: normalizedData } : {}),
    };
  }

  const existingGuidance = readActionGuidance(normalizedData?.guidance);
  const inferredNextCommands = inferActionNextCommands(definition, actionId ?? normalizedLogin.action, normalizedData);
  const nextCommands = uniqueStrings([...(existingGuidance?.nextCommands ?? []), ...inferredNextCommands]);
  const capabilityMetadata = resolvePlatformCapabilityMetadata(definition as PlatformDefinition);
  const meta = inferResultMeta(normalizedData);

  return {
    ...normalizedLogin,
    data: {
      ...(normalizedData ?? {}),
      guidance: {
        ...(existingGuidance ?? {}),
        stability: existingGuidance?.stability ?? capabilityMetadata.stability,
        ...(nextCommands.length > 0 ? { nextCommands } : {}),
        ...((existingGuidance?.recommendedNextCommand ?? nextCommands[0]) ? { recommendedNextCommand: existingGuidance?.recommendedNextCommand ?? nextCommands[0] } : {}),
      } satisfies ActionGuidanceMetadata,
      ...(meta ? { meta: { ...(toRecord(normalizedData?.meta) ?? {}), ...meta } } : {}),
    },
  };
}

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

  const capabilityIds = getCapabilityIds(definition);
  const prefix = buildCommandPrefix(definition);

  const preferred = CAPABILITY_PRIORITY.find((id) => capabilityIds.includes(id));
  const commands = uniqueStrings([
    preferred ? `${prefix} ${preferred} --json` : "",
    capabilityIds.includes("status") ? `${prefix} status --json` : "",
    `${prefix} capabilities --json`,
  ]);

  return commands;
}

function inferActionNextCommands(
  definition: Pick<PlatformDefinition, "id" | "category" | "commandCategories" | "capabilities">,
  action: string,
  data?: Record<string, unknown>,
): string[] {
  const capabilityIds = getCapabilityIds(definition);
  const prefix = buildCommandPrefix(definition, data);
  const suggestions = ACTION_FOLLOW_UPS[action] ?? [];
  const chosen = suggestions.find((id) => capabilityIds.includes(id));

  return uniqueStrings([
    chosen ? `${prefix} ${chosen} --json` : "",
    action !== "capabilities" ? `${prefix} capabilities --json` : "",
  ]);
}

function getCapabilityIds(
  definition: Pick<PlatformDefinition, "id" | "capabilities">,
): string[] {
  return definition.capabilities?.map((capability) => capability.id) ?? [...(CUSTOM_CAPABILITY_IDS[definition.id] ?? [])];
}

function buildCommandPrefix(
  definition: Pick<PlatformDefinition, "id" | "category" | "commandCategories">,
  data?: Record<string, unknown>,
): string {
  if (definition.id === "http") {
    const target = typeof data?.target === "string" && data.target.trim().length > 0 ? data.target.trim() : "<target>";
    return `${buildPlatformCommandPrefix(definition)} ${target}`;
  }
  return buildPlatformCommandPrefix(definition);
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

function readActionGuidance(value: unknown): ActionGuidanceMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const guidance = value as Partial<ActionGuidanceMetadata>;
  const nextCommands = Array.isArray(guidance.nextCommands)
    ? guidance.nextCommands.filter((item): item is string => typeof item === "string" && item.length > 0)
    : undefined;

  return {
    ...(typeof guidance.recommendedNextCommand === "string" && guidance.recommendedNextCommand.length > 0
      ? { recommendedNextCommand: guidance.recommendedNextCommand }
      : {}),
    ...(nextCommands && nextCommands.length > 0 ? { nextCommands } : {}),
    ...(guidance.stability === "stable" || guidance.stability === "partial" || guidance.stability === "experimental" || guidance.stability === "unknown"
      ? { stability: guidance.stability }
      : {}),
  };
}

function inferResultMeta(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }

  const itemsAlias = inferItemsAlias(data);
  if (itemsAlias) {
    return {
      listKey: "items",
      count: itemsAlias.value.length,
      ...(itemsAlias.key !== "items" ? { sourceListKey: itemsAlias.key } : {}),
    };
  }

  return undefined;
}

function normalizeResultDataShape(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }

  const normalized: Record<string, unknown> = { ...data };
  const itemsAlias = inferItemsAlias(data);
  if (!Array.isArray(normalized.items) && itemsAlias) {
    normalized.items = itemsAlias.value;
  }

  const entityAlias = inferEntityAlias(data);
  if (!hasNonArrayObject(normalized.entity) && entityAlias) {
    normalized.entity = entityAlias.value;
  }

  return normalized;
}

function inferItemsAlias(
  data: Record<string, unknown>,
): { key: string; value: unknown[] } | undefined {
  for (const key of LIST_ALIAS_KEYS) {
    const value = data[key];
    if (Array.isArray(value)) {
      return {
        key,
        value,
      };
    }
  }

  return undefined;
}

function inferEntityAlias(
  data: Record<string, unknown>,
): { key: string; value: Record<string, unknown> } | undefined {
  for (const key of ENTITY_ALIAS_KEYS) {
    const value = data[key];
    if (hasNonArrayObject(value)) {
      return {
        key,
        value,
      };
    }
  }

  return undefined;
}

function hasNonArrayObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
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
