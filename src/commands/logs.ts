import { Command } from "commander";

import { MikaCliError } from "../errors.js";
import {
  clearActionLogs,
  getActionLog,
  listActionLogs,
  type ActionLogEntry,
  type ActionLogStatus,
} from "../utils/action-log.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printActionLogTable, printJson } from "../utils/output.js";

type LogsListOptions = {
  provider?: string;
  platform?: string;
  status?: string;
  since?: string;
  limit?: number;
};

export function createLogsCommand(): Command {
  const command = new Command("logs")
    .description("Inspect recent MikaCLI action logs")
    .option("--provider <platform>", "Filter to one provider/platform, for example x or youtube")
    .option("--platform <platform>", "Alias for --provider")
    .option("--status <status>", "Filter by status: success or failed")
    .option("--since <duration>", "Only include entries newer than a relative window like 15m, 2h, or 7d")
    .option("--limit <count>", "Maximum rows to return (default: 20)", parsePositiveInteger, 20)
    .addHelpText(
      "after",
      `
Examples:
  mikacli logs
  mikacli logs --provider x
  mikacli logs --status failed --since 1h
  mikacli logs --limit 50 --json
  mikacli logs show 123e4567-e89b-12d3-a456-426614174000
  mikacli logs clear
`,
    )
    .action(async function logsAction(this: Command, options: LogsListOptions) {
      const ctx = resolveCommandContext(this);
      const entries = await loadActionLogEntries(options);

      if (ctx.json) {
        printJson({
          ok: true,
          count: entries.length,
          items: entries,
        });
        return;
      }

      printActionLogTable(entries.map((entry) => toPrintableLogRow(entry)));
    });

  command
    .command("show")
    .description("Show one action log entry by id")
    .argument("<id>", "Log entry id")
    .action(async function logsShowAction(this: Command, id: string) {
      const ctx = resolveCommandContext(this);
      const entry = await getActionLog(id);
      if (!entry) {
        throw new MikaCliError("ACTION_LOG_NOT_FOUND", `No action log entry found for id "${id}".`);
      }

      if (ctx.json) {
        printJson({
          ok: true,
          entry,
        });
        return;
      }

      printActionLogDetail(entry);
    });

  command
    .command("clear")
    .description("Clear the saved action log history")
    .action(async function logsClearAction(this: Command) {
      const ctx = resolveCommandContext(this);
      await clearActionLogs();

      const payload = {
        ok: true,
        message: "Action logs cleared.",
      };

      if (ctx.json) {
        printJson(payload);
        return;
      }

      console.log(payload.message);
    });

  return command;
}

export async function loadActionLogEntries(options: LogsListOptions): Promise<ActionLogEntry[]> {
  const provider = normalizeProviderFilter(options.provider ?? options.platform);
  const status = normalizeActionLogStatus(options.status);
  const since = parseSinceWindow(options.since);

  return listActionLogs({
    ...(provider ? { provider } : {}),
    ...(status ? { status } : {}),
    ...(since ? { since } : {}),
    limit: options.limit ?? 20,
  });
}

export function normalizeActionLogStatus(value: string | undefined): ActionLogStatus | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "success" || normalized === "failed") {
    return normalized;
  }

  throw new MikaCliError("INVALID_LOG_STATUS", `Expected log status to be "success" or "failed", received "${value}".`);
}

export function parseSinceWindow(value: string | undefined, now = new Date()): Date | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)([smhdw])$/u);
  if (!match) {
    throw new MikaCliError(
      "INVALID_LOG_WINDOW",
      `Expected --since to look like 15m, 2h, or 7d, received "${value}".`,
    );
  }

  const amount = Number(match[1]);
  const multipliers = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  } as const;
  const unit = match[2] as keyof typeof multipliers;

  return new Date(now.getTime() - amount * multipliers[unit]);
}

function normalizeProviderFilter(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new MikaCliError("INVALID_LOG_LIMIT", `Expected a positive integer limit, received "${value}".`);
  }

  return parsed;
}

function toPrintableLogRow(entry: ActionLogEntry): {
  time: string;
  command: string;
  status: "success" | "failed";
  provider?: string;
  account?: string;
  message: string;
} {
  return {
    time: formatActionLogTime(entry.finishedAt),
    command: entry.command,
    status: entry.status,
    provider: entry.platform,
    account: entry.account,
    message: entry.message,
  };
}

function printActionLogDetail(entry: ActionLogEntry): void {
  console.log(`id: ${entry.id}`);
  console.log(`time: ${entry.finishedAt}`);
  console.log(`duration: ${entry.durationMs}ms`);
  console.log(`status: ${entry.status}`);
  console.log(`command: ${entry.command}`);

  if (entry.commandPath) {
    console.log(`path: ${entry.commandPath}`);
  }

  if (entry.platform) {
    console.log(`provider: ${entry.platform}`);
  }

  if (entry.account) {
    console.log(`account: ${entry.account}`);
  }

  if (entry.action) {
    console.log(`action: ${entry.action}`);
  }

  console.log(`message: ${entry.message}`);

  if (entry.errorCode) {
    console.log(`error: ${entry.errorCode}`);
  }

  if (entry.resultId) {
    console.log(`result id: ${entry.resultId}`);
  }

  if (entry.resultUrl) {
    console.log(`url: ${entry.resultUrl}`);
  }

  if (entry.user) {
    console.log(`user: ${entry.user}`);
  }

  if (entry.nextCommand) {
    console.log(`next: ${entry.nextCommand}`);
  }

  if (entry.hint) {
    console.log(`hint: ${entry.hint}`);
  }
}

function formatActionLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
