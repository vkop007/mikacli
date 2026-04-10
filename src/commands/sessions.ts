import { access, rm } from "node:fs/promises";
import { constants } from "node:fs";

import { Command } from "commander";

import { getConnectionPath, getSessionPath, sanitizeAccountName } from "../config.js";
import { ConnectionStore } from "../core/auth/connection-store.js";
import { buildPlatformCommandPrefix } from "../core/runtime/platform-command-prefix.js";
import { AutoCliError } from "../errors.js";
import { getPlatformDisplayName, isPlatform } from "../platforms/config.js";
import { getPlatformDefinition } from "../platforms/index.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson, printSessionsTable, printStatusTable } from "../utils/output.js";
import { refreshConnectionStatusEntry } from "./status.js";

import type { ConnectionRecord } from "../core/auth/auth-types.js";
import type { Platform } from "../types.js";

type SessionEntry = {
  platform: Platform;
  displayName: string;
  account: string;
  auth: ConnectionRecord["auth"]["kind"];
  source?: string;
  status: ConnectionRecord["status"]["state"];
  message?: string;
  user?: string;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
  path: string;
  metadata?: Record<string, unknown>;
};

type SessionSummary = {
  total: number;
  active: number;
  expired: number;
  unknown: number;
  byAuth: Record<ConnectionRecord["auth"]["kind"], number>;
};

type SessionValidationEntry = SessionEntry & {
  connected: boolean;
  basis: "live" | "refresh-failed";
  refreshError?: string;
  next?: string;
};

type SessionValidationSummary = {
  total: number;
  active: number;
  expired: number;
  unknown: number;
  live: number;
  refreshFailed: number;
  updated: number;
};

const REDACTED_METADATA_VALUE = "[redacted]";

export function createSessionsCommand(): Command {
  const command = new Command("sessions")
    .description("Inspect and manage saved cookie sessions and token connections")
    .option("--platform <platform>", "Filter by platform id")
    .option("--status <state>", "Filter by state: active, expired, unknown")
    .option("--auth <kind>", "Filter by auth kind: cookies, apiKey, botToken, session, oauth2, none")
    .addHelpText(
      "after",
      `
Examples:
  autocli sessions
  autocli sessions --platform x
  autocli sessions validate
  autocli sessions validate x default
  autocli sessions show x cookie-check
  autocli sessions remove spotify default
`,
    )
    .action(async function sessionsListAction(this: Command) {
      await handleSessionsList(this);
    });

  command
    .command("list")
    .description("List saved sessions and token connections")
    .option("--platform <platform>", "Filter by platform id")
    .option("--status <state>", "Filter by state: active, expired, unknown")
    .option("--auth <kind>", "Filter by auth kind: cookies, apiKey, botToken, session, oauth2, none")
    .action(async function sessionsListCommandAction(this: Command) {
      await handleSessionsList(this);
    });

  command
    .command("validate")
    .description("Live-validate saved sessions and token connections")
    .argument("[platform]", "Optional platform id")
    .argument("[account]", "Optional saved account name; when omitted, all accounts for the platform are validated")
    .action(async function sessionsValidateAction(this: Command, platform?: string, account?: string) {
      await handleSessionsValidate(this, platform, account);
    });

  command
    .command("show")
    .description("Show one saved session or token connection")
    .argument("<platform>", "Platform id")
    .argument("[account]", "Optional saved account name; defaults to the latest one for that platform")
    .action(async function sessionsShowAction(this: Command, platform: string, account?: string) {
      const ctx = resolveCommandContext(this);
      const entry = await loadSessionEntry(requirePlatform(platform), account);

      if (ctx.json) {
        printJson({
          ok: true,
          session: entry,
        });
        return;
      }

      printSessionEntry(entry);
    });

  command
    .command("remove")
    .alias("rm")
    .description("Remove one saved session or token connection")
    .argument("<platform>", "Platform id")
    .argument("[account]", "Optional saved account name; defaults to the latest one for that platform")
    .action(async function sessionsRemoveAction(this: Command, platform: string, account?: string) {
      const ctx = resolveCommandContext(this);
      const store = new ConnectionStore();
      const loaded = await store.loadConnection(requirePlatform(platform), account);
      const removed = await removeSessionArtifacts(loaded.connection.platform, loaded.connection.account);

      const payload = {
        ok: true,
        platform: loaded.connection.platform,
        account: loaded.connection.account,
        removedCount: removed.length,
        removed,
        message: `Removed ${removed.length} saved record${removed.length === 1 ? "" : "s"} for ${loaded.connection.platform}/${loaded.connection.account}.`,
      };

      if (ctx.json) {
        printJson(payload);
        return;
      }

      console.log(payload.message);
      for (const entry of removed) {
        console.log(`${entry.kind}: ${entry.path}`);
      }
    });

  return command;
}

async function handleSessionsList(command: Command): Promise<void> {
  const ctx = resolveCommandContext(command);
  const options = command.optsWithGlobals<{
    platform?: string;
    status?: string;
    auth?: string;
  }>();

  const entries = await listSessionEntries();
  const filtered = filterSessionEntries(entries, {
    platform: options.platform,
    status: options.status,
    auth: options.auth,
  });

  if (ctx.json) {
    const summary = summarizeSessionEntries(filtered);
    printJson({
      ok: true,
      summary,
      recommendations: buildSessionRecommendations(summary),
      sessions: filtered,
    });
    return;
  }

  const summary = summarizeSessionEntries(filtered);
  console.log(
    `Saved records: ${summary.total}. ${summary.active} active, ${summary.expired} expired, ${summary.unknown} unknown.`,
  );
  printSessionsTable(
    filtered.map((entry) => ({
      platform: entry.platform,
      account: entry.account,
      auth: describeAuth(entry),
      status: entry.status,
      updated: formatTimestamp(entry.updatedAt),
      path: entry.path,
    })),
  );

  const recommendations = buildSessionRecommendations(summary);
  if (recommendations.length > 0) {
    console.log("");
    console.log("next:");
    for (const recommendation of recommendations) {
      console.log(`- ${recommendation}`);
    }
  }
}

export async function listSessionEntries(connectionStore = new ConnectionStore()): Promise<SessionEntry[]> {
  const connections = await connectionStore.listConnections();
  return connections.map(({ connection, path }) => toSessionEntry(connection, path));
}

export async function loadSessionEntry(platform: Platform, account?: string, connectionStore = new ConnectionStore()): Promise<SessionEntry> {
  const loaded = await connectionStore.loadConnection(platform, account);
  return toSessionEntry(loaded.connection, loaded.path);
}

export async function validateSessionEntries(input: {
  platform?: string;
  account?: string;
  connectionStore?: Pick<ConnectionStore, "listConnections" | "saveConnection">;
}): Promise<SessionValidationEntry[]> {
  const connectionStore = input.connectionStore ?? new ConnectionStore();
  const platform = input.platform ? requirePlatform(input.platform) : undefined;
  const account = input.account ? sanitizeAccountName(input.account) : undefined;
  const listed = await connectionStore.listConnections();
  const filtered = listed.filter((entry) => {
    if (platform && entry.connection.platform !== platform) {
      return false;
    }

    if (account && entry.connection.account !== account) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0 && (platform || account)) {
    throw new AutoCliError(
      "SESSION_NOT_FOUND",
      account
        ? `No saved ${platform ?? "provider"} record found for account "${account}".`
        : `No saved records found for ${platform}.`,
      {
        details: {
          ...(platform ? { platform } : {}),
          ...(account ? { account } : {}),
        },
      },
    );
  }

  return Promise.all(
    filtered.map(async (entry) => {
      const refreshed = await refreshConnectionStatusEntry(entry);
      if (refreshed.basis === "live") {
        const updatedConnection = applyValidatedStatus(entry.connection, refreshed);
        const savedPath = await connectionStore.saveConnection(updatedConnection);
        return toValidatedSessionEntry(updatedConnection, savedPath, refreshed);
      }

      return toValidatedSessionEntry(entry.connection, entry.path, refreshed);
    }),
  );
}

export function summarizeSessionEntries(entries: readonly SessionEntry[]): SessionSummary {
  const byAuth: SessionSummary["byAuth"] = {
    cookies: 0,
    apiKey: 0,
    botToken: 0,
    session: 0,
    oauth2: 0,
    none: 0,
  };

  const summary: SessionSummary = {
    total: entries.length,
    active: 0,
    expired: 0,
    unknown: 0,
    byAuth,
  };

  for (const entry of entries) {
    summary[entry.status] += 1;
    summary.byAuth[entry.auth] += 1;
  }

  return summary;
}

export function summarizeValidatedSessionEntries(entries: readonly SessionValidationEntry[]): SessionValidationSummary {
  const summary: SessionValidationSummary = {
    total: entries.length,
    active: 0,
    expired: 0,
    unknown: 0,
    live: 0,
    refreshFailed: 0,
    updated: 0,
  };

  for (const entry of entries) {
    summary[entry.status] += 1;
    if (entry.basis === "live") {
      summary.live += 1;
      summary.updated += 1;
    } else {
      summary.refreshFailed += 1;
    }
  }

  return summary;
}

export function buildSessionRecommendations(summary: SessionSummary): string[] {
  const recommendations: string[] = [];
  if (summary.total === 0) {
    recommendations.push("Run `autocli login --browser` or a provider-specific `login` command to save your first reusable session.");
    return recommendations;
  }

  if (summary.expired > 0) {
    recommendations.push("Run `autocli sessions validate` to confirm expired records live, then refresh them with the provider's `login` command.");
  }

  if (summary.unknown > 0) {
    recommendations.push("Run `autocli sessions validate` to replace unknown saved state with a live provider check.");
  }

  return recommendations;
}

async function handleSessionsValidate(command: Command, platform?: string, account?: string): Promise<void> {
  const ctx = resolveCommandContext(command);
  const entries = await validateSessionEntries({
    platform,
    account,
  });
  const summary = summarizeValidatedSessionEntries(entries);

  if (ctx.json) {
    printJson({
      ok: true,
      validated: summary.total,
      summary,
      sessions: entries,
    });
    return;
  }

  console.log(
    `Validated ${summary.total} saved record${summary.total === 1 ? "" : "s"}. ${summary.active} active, ${summary.expired} expired, ${summary.unknown} unknown. ${summary.live} live, ${summary.refreshFailed} refresh-failed.`,
  );

  if (summary.updated > 0) {
    console.log(`Updated ${summary.updated} saved record${summary.updated === 1 ? "" : "s"} with fresh live status.`);
  }

  printStatusTable(
    entries.map((entry) => ({
      platform: entry.platform,
      account: entry.account,
      status: entry.status,
      basis: entry.basis,
      user: entry.user,
      message: entry.message,
    })),
  );

  const nextCommands = Array.from(
    new Set(entries.map((entry) => entry.next).filter((value): value is string => typeof value === "string" && value.length > 0)),
  );

  if (nextCommands.length > 0) {
    console.log("");
    console.log("next:");
    for (const next of nextCommands) {
      console.log(`- ${next}`);
    }
  }
}

function toSessionEntry(connection: ConnectionRecord, path: string): SessionEntry {
  return {
    platform: connection.platform,
    displayName: getPlatformDisplayName(connection.platform),
    account: connection.account,
    auth: connection.auth.kind,
    source:
      connection.auth.kind === "cookies"
        ? connection.auth.source
        : "provider" in connection.auth
          ? connection.auth.provider
          : undefined,
    status: connection.status.state,
    message: connection.status.message,
    user: connection.user?.username ?? connection.user?.displayName,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    lastValidatedAt: connection.status.lastValidatedAt,
    path,
    metadata: sanitizeSessionMetadata(connection.metadata),
  };
}

function toValidatedSessionEntry(
  connection: ConnectionRecord,
  path: string,
  status: Awaited<ReturnType<typeof refreshConnectionStatusEntry>>,
): SessionValidationEntry {
  const entry = toSessionEntry(connection, path);
  return {
    ...entry,
    connected: status.connected,
    basis: status.basis === "live" ? "live" : "refresh-failed",
    ...(status.refreshError ? { refreshError: status.refreshError } : {}),
    ...(status.status !== "active" ? { next: buildProviderLoginCommand(connection.platform, connection.account) } : {}),
    message: status.message ?? entry.message,
    user: status.user?.username ?? status.user?.displayName ?? entry.user,
    lastValidatedAt: status.lastValidatedAt ?? entry.lastValidatedAt,
  };
}

function applyValidatedStatus(
  connection: ConnectionRecord,
  status: Awaited<ReturnType<typeof refreshConnectionStatusEntry>>,
): ConnectionRecord {
  const lastValidatedAt = status.lastValidatedAt ?? new Date().toISOString();
  return {
    ...connection,
    updatedAt: lastValidatedAt,
    status: {
      state: status.status,
      message: status.message,
      lastValidatedAt,
    },
    user: status.user ?? connection.user,
  };
}

function buildProviderLoginCommand(platform: Platform, account: string): string | undefined {
  const definition = getPlatformDefinition(platform);
  if (!definition) {
    return undefined;
  }

  const base = `${buildPlatformCommandPrefix(definition)} login`;
  return account === "default" ? base : `${base} --account ${account}`;
}

function sanitizeSessionMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  return sanitizeMetadataValue(metadata) as Record<string, unknown>;
}

function sanitizeMetadataValue(value: unknown, currentKey?: string): unknown {
  if (currentKey && isSensitiveMetadataKey(currentKey)) {
    return REDACTED_METADATA_VALUE;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadataValue(entry, currentKey));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, sanitizeMetadataValue(nested, key)]),
  );
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/giu, "").toLowerCase();

  if (normalized === "authorization" || normalized === "cookie" || normalized === "cookies" || normalized === "cookiejar") {
    return true;
  }

  if (normalized.includes("password") || normalized.includes("secret") || normalized.includes("apikey") || normalized.includes("sessionstring")) {
    return true;
  }

  if (normalized === "auth") {
    return false;
  }

  return normalized.endsWith("token") || normalized.endsWith("jwt") || normalized.endsWith("sessionid") || normalized === "csrftoken";
}

function filterSessionEntries(
  entries: SessionEntry[],
  filters: {
    platform?: string;
    status?: string;
    auth?: string;
  },
): SessionEntry[] {
  const platform = filters.platform ? requirePlatform(filters.platform) : undefined;
  const allowedStatus = filters.status ? requireStatus(filters.status) : undefined;
  const allowedAuth = filters.auth ? requireAuthKind(filters.auth) : undefined;

  return entries.filter((entry) => {
    if (platform && entry.platform !== platform) {
      return false;
    }

    if (allowedStatus && entry.status !== allowedStatus) {
      return false;
    }

    if (allowedAuth && entry.auth !== allowedAuth) {
      return false;
    }

    return true;
  });
}

async function removeSessionArtifacts(platform: Platform, account: string): Promise<Array<{ kind: "session" | "connection"; path: string }>> {
  const store = new ConnectionStore();
  let authDir: string | undefined;
  try {
    const loaded = await store.loadConnection(platform, account);
    const candidate = loaded.connection.metadata?.authDir;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      authDir = candidate;
    }
  } catch {
    authDir = undefined;
  }

  const targets = [
    { kind: "session" as const, path: getSessionPath(platform, account) },
    { kind: "connection" as const, path: getConnectionPath(platform, account) },
  ];

  if (authDir) {
    targets.push({ kind: "connection" as const, path: authDir });
  }

  const removed: Array<{ kind: "session" | "connection"; path: string }> = [];
  for (const target of targets) {
    if (!(await fileExists(target.path))) {
      continue;
    }

    await rm(target.path, { force: true, recursive: true });
    removed.push(target);
  }

  if (removed.length === 0) {
    throw new AutoCliError("SESSION_NOT_FOUND", `No saved records found for ${platform}/${account}.`, {
      details: {
        platform,
        account,
      },
    });
  }

  return removed;
}

function requirePlatform(value: string): Platform {
  if (!isPlatform(value)) {
    throw new AutoCliError("INVALID_PLATFORM", `Unknown platform "${value}".`, {
      details: {
        platform: value,
      },
    });
  }

  return value;
}

function requireStatus(value: string): "active" | "expired" | "unknown" {
  if (value === "active" || value === "expired" || value === "unknown") {
    return value;
  }

  throw new AutoCliError("INVALID_STATUS_FILTER", `Unknown session state "${value}". Use active, expired, or unknown.`, {
    details: {
      status: value,
    },
  });
}

function requireAuthKind(value: string): ConnectionRecord["auth"]["kind"] {
  if (value === "cookies" || value === "apiKey" || value === "botToken" || value === "session" || value === "oauth2" || value === "none") {
    return value;
  }

  throw new AutoCliError(
    "INVALID_AUTH_FILTER",
    `Unknown auth kind "${value}". Use cookies, apiKey, botToken, session, oauth2, or none.`,
    {
      details: {
        auth: value,
      },
    },
  );
}

function describeAuth(entry: SessionEntry): string {
  const suffix = entry.source ? `:${entry.source}` : "";
  return `${entry.auth}${suffix}`;
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().replace(".000Z", "Z").replace("T", " ");
}

function printSessionEntry(entry: SessionEntry): void {
  console.log(`platform: ${entry.platform}`);
  console.log(`display: ${entry.displayName}`);
  console.log(`account: ${entry.account}`);
  console.log(`auth: ${describeAuth(entry)}`);
  console.log(`status: ${entry.status}`);
  console.log(`created: ${entry.createdAt}`);
  console.log(`updated: ${entry.updatedAt}`);
  console.log(`path: ${entry.path}`);

  if (entry.user) {
    console.log(`user: ${entry.user}`);
  }

  if (entry.lastValidatedAt) {
    console.log(`lastValidatedAt: ${entry.lastValidatedAt}`);
  }

  if (entry.message) {
    console.log(`message: ${entry.message}`);
  }

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    console.log("metadata:");
    console.log(JSON.stringify(entry.metadata, null, 2));
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
