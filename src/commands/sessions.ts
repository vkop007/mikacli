import { access, rm } from "node:fs/promises";
import { constants } from "node:fs";

import { Command } from "commander";

import { getConnectionPath, getSessionPath } from "../config.js";
import { ConnectionStore } from "../core/auth/connection-store.js";
import { AutoCliError } from "../errors.js";
import { getPlatformDisplayName, isPlatform } from "../platforms/config.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson, printSessionsTable } from "../utils/output.js";

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

export function createSessionsCommand(): Command {
  const command = new Command("sessions")
    .description("Inspect and manage saved cookie sessions and token connections")
    .option("--platform <platform>", "Filter by platform id")
    .option("--status <state>", "Filter by state: active, expired, unknown")
    .option("--auth <kind>", "Filter by auth kind: cookies, apiKey, botToken, oauth2, none")
    .addHelpText(
      "after",
      `
Examples:
  autocli sessions
  autocli sessions --platform x
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
    .option("--auth <kind>", "Filter by auth kind: cookies, apiKey, botToken, oauth2, none")
    .action(async function sessionsListCommandAction(this: Command) {
      await handleSessionsList(this);
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
    printJson({
      ok: true,
      sessions: filtered,
    });
    return;
  }

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
}

export async function listSessionEntries(connectionStore = new ConnectionStore()): Promise<SessionEntry[]> {
  const connections = await connectionStore.listConnections();
  return connections.map(({ connection, path }) => toSessionEntry(connection, path));
}

export async function loadSessionEntry(platform: Platform, account?: string, connectionStore = new ConnectionStore()): Promise<SessionEntry> {
  const loaded = await connectionStore.loadConnection(platform, account);
  return toSessionEntry(loaded.connection, loaded.path);
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
    metadata: connection.metadata,
  };
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
  const targets = [
    { kind: "session" as const, path: getSessionPath(platform, account) },
    { kind: "connection" as const, path: getConnectionPath(platform, account) },
  ];

  const removed: Array<{ kind: "session" | "connection"; path: string }> = [];
  for (const target of targets) {
    if (!(await fileExists(target.path))) {
      continue;
    }

    await rm(target.path, { force: true });
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
  if (value === "cookies" || value === "apiKey" || value === "botToken" || value === "oauth2" || value === "none") {
    return value;
  }

  throw new AutoCliError(
    "INVALID_AUTH_FILTER",
    `Unknown auth kind "${value}". Use cookies, apiKey, botToken, oauth2, or none.`,
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
