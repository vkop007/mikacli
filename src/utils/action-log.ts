import { appendFile, readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { ACTION_LOG_PATH, ensureParentDirectory } from "../config.js";

export type ActionLogStatus = "success" | "failed";

export interface ActionLogEntry {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: ActionLogStatus;
  command: string;
  commandPath?: string;
  platform?: string;
  account?: string;
  action?: string;
  message: string;
  errorCode?: string;
  nextCommand?: string;
  hint?: string;
  resultId?: string;
  resultUrl?: string;
  user?: string;
}

export interface ActionLogListOptions {
  provider?: string;
  status?: ActionLogStatus;
  since?: Date;
  limit?: number;
}

const ACTION_LOG_CAPTURED = Symbol.for("autocli.actionLogCaptured");
const CATEGORY_COMMANDS = new Set([
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
  "tools",
]);
const ROOT_SUBCOMMANDS: Record<string, Set<string>> = {
  logs: new Set(["show", "clear"]),
  jobs: new Set(["list", "show", "watch", "download", "cancel"]),
  sessions: new Set(["validate", "repair", "show", "remove"]),
};

export async function appendActionLog(
  input: Omit<ActionLogEntry, "id"> & { id?: string },
  filePath = ACTION_LOG_PATH,
): Promise<ActionLogEntry> {
  const entry: ActionLogEntry = {
    ...input,
    id: input.id ?? randomUUID(),
  };

  await ensureParentDirectory(filePath);
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export async function listActionLogs(
  options: ActionLogListOptions = {},
  filePath = ACTION_LOG_PATH,
): Promise<ActionLogEntry[]> {
  const entries = await readActionLogs(filePath);
  const filtered = entries.filter((entry) => {
    if (options.provider && entry.platform !== options.provider) {
      return false;
    }

    if (options.status && entry.status !== options.status) {
      return false;
    }

    if (options.since) {
      const finishedAt = Date.parse(entry.finishedAt);
      if (Number.isNaN(finishedAt) || finishedAt < options.since.getTime()) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt));

  if (!options.limit || options.limit <= 0) {
    return filtered;
  }

  return filtered.slice(0, options.limit);
}

export async function getActionLog(id: string, filePath = ACTION_LOG_PATH): Promise<ActionLogEntry | undefined> {
  const entries = await readActionLogs(filePath);
  return entries.find((entry) => entry.id === id);
}

export async function clearActionLogs(filePath = ACTION_LOG_PATH): Promise<void> {
  await rm(filePath, { force: true });
}

export function markActionLogCaptured(error: unknown): void {
  if (error && (typeof error === "object" || typeof error === "function")) {
    Reflect.set(error, ACTION_LOG_CAPTURED, true);
  }
}

export function wasActionLogCaptured(error: unknown): boolean {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return false;
  }

  return Reflect.get(error, ACTION_LOG_CAPTURED) === true;
}

export function buildActionLogCommandLabel(input: {
  platform?: string;
  action?: string;
  commandPath?: string;
}): string {
  if (input.platform && input.action) {
    return input.platform === input.action ? input.platform : `${input.platform}/${input.action}`;
  }

  if (input.commandPath) {
    return summarizeCommandPath(input.commandPath);
  }

  return "autocli";
}

export function inferSafeCommandPath(argv: readonly string[]): string {
  const positionals = argv.filter((token) => !token.startsWith("-"));
  if (positionals.length === 0) {
    return "autocli";
  }

  const [first, second, third] = positionals;
  if (!first) {
    return "autocli";
  }

  if (CATEGORY_COMMANDS.has(first)) {
    if (!second) {
      return `autocli ${first}`;
    }

    if (!third) {
      return `autocli ${first} ${second}`;
    }

    return `autocli ${first} ${second} ${third}`;
  }

  if (second && ROOT_SUBCOMMANDS[first]?.has(second)) {
    return `autocli ${first} ${second}`;
  }

  return `autocli ${first}`;
}

export function summarizeCommandPath(commandPath: string): string {
  const tokens = commandPath.trim().split(/\s+/u);
  const normalized = tokens[0] === "autocli" ? tokens.slice(1) : tokens;

  if (normalized.length >= 3) {
    return `${normalized[1]}/${normalized[2]}`;
  }

  if (normalized.length === 2) {
    return `${normalized[0]}/${normalized[1]}`;
  }

  return normalized[0] ?? "autocli";
}

async function readActionLogs(filePath: string): Promise<ActionLogEntry[]> {
  const text = await readFile(filePath, "utf8").catch((error) => {
    if (isMissingFileError(error)) {
      return "";
    }

    throw error;
  });

  if (!text.trim()) {
    return [];
  }

  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as ActionLogEntry;
        return isActionLogEntry(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
}

function isMissingFileError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function isActionLogEntry(value: unknown): value is ActionLogEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entry = value as Partial<ActionLogEntry>;
  return typeof entry.id === "string"
    && typeof entry.startedAt === "string"
    && typeof entry.finishedAt === "string"
    && typeof entry.durationMs === "number"
    && (entry.status === "success" || entry.status === "failed")
    && typeof entry.command === "string"
    && typeof entry.message === "string";
}
