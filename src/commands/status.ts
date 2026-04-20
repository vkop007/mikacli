import { Command } from "commander";

import { ConnectionStore } from "../core/auth/connection-store.js";
import { getPlatformDefinition } from "../platforms/index.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson, printStatusTable } from "../utils/output.js";

import type { ConnectionRecord } from "../core/auth/auth-types.js";
import type { AdapterStatusResult } from "../types.js";

type StatusBasis = "last-known" | "live" | "refresh-failed";

export type RootStatusEntry = AdapterStatusResult & {
  auth: ConnectionRecord["auth"]["kind"];
  basis: StatusBasis;
  refreshError?: string;
};

type StatusSummary = {
  total: number;
  active: number;
  expired: number;
  unknown: number;
  live: number;
  lastKnown: number;
  refreshFailed: number;
};

type StatusAdapter = {
  getStatus(account?: string): Promise<AdapterStatusResult>;
};

export type ListedConnection = {
  connection: ConnectionRecord;
  path: string;
};

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Show saved account health, with optional live refresh against each provider")
    .option("--refresh", "Live-validate each saved account instead of showing only the last known saved status")
    .addHelpText(
      "after",
      `
Examples:
  mikacli status
  mikacli status --refresh
  mikacli status --json
  mikacli status --refresh --json
`,
    )
    .action(async function statusAction(this: Command) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{ refresh?: boolean }>();
      const connectionStore = new ConnectionStore();
      const sessions = await loadRootStatusEntries({
        refresh: Boolean(options.refresh),
        connectionStore,
      });
      const summary = summarizeRootStatusEntries(sessions);

      if (ctx.json) {
        printJson({
          ok: true,
          refreshed: Boolean(options.refresh),
          summary,
          sessions,
        });
        return;
      }

      if (options.refresh) {
        console.log(
          `Saved records: ${summary.total}. ${summary.live} live, ${summary.lastKnown} last-known, ${summary.refreshFailed} refresh-failed.`,
        );
      } else {
        console.log(
          `Saved records: ${summary.total}. Showing last-known saved status; use \`mikacli status --refresh\` for live validation.`,
        );
      }

      printStatusTable(
        sessions.map((status) => ({
          platform: status.platform,
          account: status.account,
          status: status.status,
          basis: status.basis,
          user: status.user?.username ?? status.user?.displayName,
          message: status.message,
        })),
      );

      if (!options.refresh && sessions.length > 0) {
        console.log("");
        console.log("hint: use `mikacli status --refresh` to re-check providers live before doing write actions.");
      }
    });
}

export async function loadRootStatusEntries(input: {
  refresh: boolean;
  connectionStore?: Pick<ConnectionStore, "listConnections">;
}): Promise<RootStatusEntry[]> {
  const connectionStore = input.connectionStore ?? new ConnectionStore();
  const connections = await connectionStore.listConnections();

  if (!input.refresh) {
    return connections.map(toLastKnownStatusEntry);
  }

  return Promise.all(connections.map((entry) => refreshConnectionStatusEntry(entry)));
}

export function summarizeRootStatusEntries(entries: readonly RootStatusEntry[]): StatusSummary {
  const summary: StatusSummary = {
    total: entries.length,
    active: 0,
    expired: 0,
    unknown: 0,
    live: 0,
    lastKnown: 0,
    refreshFailed: 0,
  };

  for (const entry of entries) {
    summary[entry.status] += 1;
    if (entry.basis === "live") {
      summary.live += 1;
    } else if (entry.basis === "last-known") {
      summary.lastKnown += 1;
    } else {
      summary.refreshFailed += 1;
    }
  }

  return summary;
}

export async function refreshConnectionStatusEntry(entry: ListedConnection): Promise<RootStatusEntry> {
  const definition = getPlatformDefinition(entry.connection.platform);
  const adapter = definition?.adapter;

  if (!hasStatusAdapter(adapter)) {
    return {
      ...toLastKnownStatusEntry(entry),
      message: appendStatusNote(entry.connection.status.message, "Live refresh unavailable for this provider."),
    };
  }

  try {
    const result = await adapter.getStatus(entry.connection.account);
    return {
      ...result,
      auth: entry.connection.auth.kind,
      basis: "live",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live refresh failed.";
    return {
      ...toLastKnownStatusEntry(entry),
      basis: "refresh-failed",
      refreshError: message,
      message: appendStatusNote(entry.connection.status.message, `Live refresh failed: ${message}`),
    };
  }
}

function toLastKnownStatusEntry(entry: ListedConnection): RootStatusEntry {
  return {
    platform: entry.connection.platform,
    account: entry.connection.account,
    sessionPath: entry.path,
    connected: entry.connection.status.state === "active",
    status: entry.connection.status.state,
    message: entry.connection.status.message,
    user: entry.connection.user,
    lastValidatedAt: entry.connection.status.lastValidatedAt,
    auth: entry.connection.auth.kind,
    basis: "last-known",
  };
}

function hasStatusAdapter(value: unknown): value is StatusAdapter {
  return Boolean(value) && typeof (value as { getStatus?: unknown }).getStatus === "function";
}

function appendStatusNote(base: string | undefined, note: string): string {
  return base && base.trim().length > 0 ? `${base} ${note}` : note;
}
