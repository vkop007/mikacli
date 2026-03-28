import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { Command } from "commander";

import { AUTOCLI_DIR, CACHE_DIR, CONNECTIONS_DIR, JOBS_DIR, SESSIONS_DIR } from "../config.js";
import { ConnectionStore } from "../core/auth/connection-store.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printDoctorTable, printJson } from "../utils/output.js";

import type { ConnectionRecord } from "../core/auth/auth-types.js";

type DoctorCheckStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  id: string;
  category: "filesystem" | "binary" | "connections";
  status: DoctorCheckStatus;
  message: string;
  details?: Record<string, unknown>;
};

type DoctorReport = {
  health: DoctorCheckStatus;
  summary: {
    pass: number;
    warn: number;
    fail: number;
    total: number;
    records: number;
    active: number;
    expired: number;
    unknown: number;
  };
  checks: DoctorCheck[];
};

const DIRECTORY_CHECKS = [
  { id: "autocli-home", label: "AutoCLI home", path: AUTOCLI_DIR },
  { id: "sessions-dir", label: "Sessions directory", path: SESSIONS_DIR },
  { id: "connections-dir", label: "Connections directory", path: CONNECTIONS_DIR },
  { id: "jobs-dir", label: "Jobs directory", path: JOBS_DIR },
  { id: "cache-dir", label: "Cache directory", path: CACHE_DIR },
] as const;

const BINARY_CHECKS = [
  {
    id: "ffmpeg",
    command: process.env.AUTOCLI_FFMPEG_BIN || "ffmpeg",
    args: ["-version"],
    purpose: "editor audio/video/image/gif",
  },
  {
    id: "ffprobe",
    command: process.env.AUTOCLI_FFPROBE_BIN || "ffprobe",
    args: ["-version"],
    purpose: "editor media inspection",
  },
  {
    id: "ffplay",
    command: "ffplay",
    args: ["-version"],
    purpose: "youtube-music local playback",
  },
  {
    id: "yt-dlp",
    command: "yt-dlp",
    args: ["--version"],
    purpose: "youtube and youtube-music downloads/playback",
  },
  {
    id: "qpdf",
    command: process.env.AUTOCLI_QPDF_BIN || "qpdf",
    args: ["--version"],
    purpose: "editor pdf advanced actions",
  },
  {
    id: "pdftotext",
    command: process.env.AUTOCLI_PDFTOTEXT_BIN || "pdftotext",
    args: ["-v"],
    purpose: "editor document pdf extraction",
  },
  {
    id: "textutil",
    command: process.env.AUTOCLI_TEXTUTIL_BIN || "textutil",
    args: ["-help"],
    purpose: "editor document conversion",
  },
  {
    id: "mdls",
    command: process.env.AUTOCLI_MDLS_BIN || "mdls",
    args: ["-name", "kMDItemFSName", "."],
    purpose: "editor document metadata on macOS",
  },
  {
    id: "zip",
    command: process.env.AUTOCLI_ZIP_BIN || "zip",
    args: ["-v"],
    purpose: "editor archive create",
  },
  {
    id: "unzip",
    command: process.env.AUTOCLI_UNZIP_BIN || "unzip",
    args: ["-v"],
    purpose: "editor archive extract and list",
  },
  {
    id: "tar",
    command: process.env.AUTOCLI_TAR_BIN || "tar",
    args: ["--version"],
    purpose: "editor archive tar flows",
  },
  {
    id: "gzip",
    command: process.env.AUTOCLI_GZIP_BIN || "gzip",
    args: ["--version"],
    purpose: "editor archive gzip",
  },
  {
    id: "gunzip",
    command: process.env.AUTOCLI_GUNZIP_BIN || "gunzip",
    args: ["--version"],
    purpose: "editor archive gunzip",
  },
  {
    id: "7z",
    command: process.env.AUTOCLI_7Z_BIN || "7z",
    args: ["--help"],
    purpose: "editor archive 7z support",
  },
] as const;

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Check local AutoCLI health, saved connection state, and optional binary availability")
    .option("--strict", "Return a failing exit code for warnings too")
    .addHelpText(
      "after",
      `
Examples:
  autocli doctor
  autocli doctor --json
  autocli doctor --strict
`,
    )
    .action(async function doctorAction(this: Command) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{ strict?: boolean }>();
      const report = await collectDoctorReport();

      if (ctx.json) {
        printJson({
          ok: true,
          health: report.health,
          summary: report.summary,
          checks: report.checks,
        });
      } else {
        const summaryLine = `Doctor health: ${report.health}. ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail.`;
        console.log(summaryLine);
        printDoctorTable(
          report.checks.map((check) => ({
            check: `${check.category}:${check.id}`,
            status: check.status,
            message: check.message,
          })),
        );
      }

      if (report.health === "fail" || (options.strict && report.health === "warn")) {
        process.exitCode = 1;
      }
    });
}

export async function collectDoctorReport(connectionStore = new ConnectionStore()): Promise<DoctorReport> {
  const [directoryChecks, binaryChecks, connectionCheck] = await Promise.all([
    Promise.all(DIRECTORY_CHECKS.map(runDirectoryCheck)),
    Promise.all(BINARY_CHECKS.map(runBinaryCheck)),
    runConnectionCheck(connectionStore),
  ]);

  const checks = [...directoryChecks, ...binaryChecks, connectionCheck];
  const summary = summarizeDoctorChecks(checks);

  return {
    health: summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "pass",
    summary,
    checks,
  };
}

export function summarizeDoctorChecks(checks: DoctorCheck[]): DoctorReport["summary"] {
  const summary = {
    pass: 0,
    warn: 0,
    fail: 0,
    total: checks.length,
    records: 0,
    active: 0,
    expired: 0,
    unknown: 0,
  };

  for (const check of checks) {
    summary[check.status] += 1;

    if (check.category === "connections" && check.details) {
      summary.records = asNumber(check.details.records) ?? summary.records;
      summary.active = asNumber(check.details.active) ?? summary.active;
      summary.expired = asNumber(check.details.expired) ?? summary.expired;
      summary.unknown = asNumber(check.details.unknown) ?? summary.unknown;
    }
  }

  return summary;
}

async function runDirectoryCheck(input: (typeof DIRECTORY_CHECKS)[number]): Promise<DoctorCheck> {
  const exists = await hasAccess(input.path, constants.F_OK);
  if (!exists) {
    return {
      id: input.id,
      category: "filesystem",
      status: "warn",
      message: `${input.label} does not exist yet. AutoCLI will create it on first use.`,
      details: {
        path: input.path,
      },
    };
  }

  const writable = await hasAccess(input.path, constants.R_OK | constants.W_OK);
  return {
    id: input.id,
    category: "filesystem",
    status: writable ? "pass" : "fail",
    message: writable ? `${input.label} is readable and writable.` : `${input.label} exists but is not writable.`,
    details: {
      path: input.path,
    },
  };
}

async function runBinaryCheck(input: (typeof BINARY_CHECKS)[number]): Promise<DoctorCheck> {
  const result = await probeBinary(input.command, input.args);
  return {
    id: input.id,
    category: "binary",
    status: result.available ? "pass" : "warn",
    message: result.available
      ? `${input.command} is available for ${input.purpose}.`
      : `${input.command} is missing. ${input.purpose} may not work until it is installed.`,
    details: {
      command: input.command,
      args: input.args,
      purpose: input.purpose,
      ...(result.error ? { error: result.error } : {}),
    },
  };
}

async function runConnectionCheck(connectionStore: ConnectionStore): Promise<DoctorCheck> {
  const connections = await connectionStore.listConnections();
  const counts = countConnectionStates(connections.map((entry) => entry.connection));

  if (connections.length === 0) {
    return {
      id: "saved-records",
      category: "connections",
      status: "pass",
      message: "No saved sessions or token connections yet.",
      details: {
        records: 0,
        active: 0,
        expired: 0,
        unknown: 0,
      },
    };
  }

  const status: DoctorCheckStatus = counts.expired > 0 ? "warn" : counts.unknown > 0 ? "warn" : "pass";
  return {
    id: "saved-records",
    category: "connections",
    status,
    message:
      status === "pass"
        ? `Found ${connections.length} saved records and all of them are marked active.`
        : `Found ${connections.length} saved records with ${counts.expired} expired and ${counts.unknown} unknown.`,
    details: {
      records: connections.length,
      active: counts.active,
      expired: counts.expired,
      unknown: counts.unknown,
    },
  };
}

function countConnectionStates(connections: ConnectionRecord[]): {
  active: number;
  expired: number;
  unknown: number;
} {
  return connections.reduce(
    (acc, connection) => {
      acc[connection.status.state] += 1;
      return acc;
    },
    {
      active: 0,
      expired: 0,
      unknown: 0,
    },
  );
}

async function hasAccess(path: string, mode: number): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

async function probeBinary(command: string, args: readonly string[]): Promise<{ available: boolean; error?: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "ignore",
    });

    child.on("error", (error) => {
      resolve({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    child.on("exit", (code) => {
      resolve({
        available: code === 0 || code === 1,
      });
    });
  });
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
