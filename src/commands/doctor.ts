import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { readFile } from "node:fs/promises";

import { Command } from "commander";

import {
  MIKACLI_DIR,
  BROWSER_DIR,
  CACHE_DIR,
  CONNECTIONS_DIR,
  DEFAULT_BROWSER_PROFILE,
  JOBS_DIR,
  SESSIONS_DIR,
  getBrowserProfileDir,
  getBrowserStatePath,
} from "../config.js";
import { ConnectionStore } from "../core/auth/connection-store.js";
import { resolveCommandContext } from "../utils/cli.js";
import { probeBrowserExecutable } from "../utils/browser-cookie-login.js";
import { printDoctorTable, printJson } from "../utils/output.js";

import type { ConnectionRecord } from "../core/auth/auth-types.js";

type DoctorCheckStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  id: string;
  category: "filesystem" | "binary" | "browser" | "connections";
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
  recommendations: string[];
  checks: DoctorCheck[];
};

type DoctorFixTarget = {
  id: string;
  kind: "brew" | "brew-cask";
  packageName: string;
  reason: string;
  checkIds: string[];
};

type DoctorFixPlan = {
  supported: boolean;
  manager?: "brew";
  targets: DoctorFixTarget[];
  skipped: {
    id: string;
    reason: string;
  }[];
  reason?: string;
};

type DoctorFixExecution = {
  attempted: boolean;
  supported: boolean;
  manager?: "brew";
  installed: DoctorFixTarget[];
  failed: Array<
    DoctorFixTarget & {
      error: string;
    }
  >;
  skipped: {
    id: string;
    reason: string;
  }[];
  reason?: string;
};

type BinaryCheckDefinition = {
  id: string;
  command: string;
  args: readonly string[];
  purpose: string;
  installHint: string;
  platforms?: readonly NodeJS.Platform[];
};

const DIRECTORY_CHECKS = [
  { id: "mikacli-home", label: "MikaCLI home", path: MIKACLI_DIR },
  { id: "sessions-dir", label: "Sessions directory", path: SESSIONS_DIR },
  { id: "connections-dir", label: "Connections directory", path: CONNECTIONS_DIR },
  { id: "jobs-dir", label: "Jobs directory", path: JOBS_DIR },
  { id: "cache-dir", label: "Cache directory", path: CACHE_DIR },
  { id: "browser-dir", label: "Browser directory", path: BROWSER_DIR },
] as const;

const BINARY_CHECKS: readonly BinaryCheckDefinition[] = [
  {
    id: "ffmpeg",
    command: process.env.MIKACLI_FFMPEG_BIN || "ffmpeg",
    args: ["-version"],
    purpose: "editor audio/video/image/gif",
    installHint: buildBinaryInstallHint("ffmpeg"),
  },
  {
    id: "ffprobe",
    command: process.env.MIKACLI_FFPROBE_BIN || "ffprobe",
    args: ["-version"],
    purpose: "editor media inspection",
    installHint: buildBinaryInstallHint("ffmpeg"),
  },
  {
    id: "ffplay",
    command: "ffplay",
    args: ["-version"],
    purpose: "youtube-music local playback",
    installHint: buildBinaryInstallHint("ffmpeg"),
  },
  {
    id: "yt-dlp",
    command: "yt-dlp",
    args: ["--version"],
    purpose: "youtube and youtube-music downloads/playback",
    installHint: buildBinaryInstallHint("yt-dlp"),
  },
  {
    id: "qpdf",
    command: process.env.MIKACLI_QPDF_BIN || "qpdf",
    args: ["--version"],
    purpose: "editor pdf advanced actions",
    installHint: buildBinaryInstallHint("qpdf"),
  },
  {
    id: "pdftotext",
    command: process.env.MIKACLI_PDFTOTEXT_BIN || "pdftotext",
    args: ["-v"],
    purpose: "editor document pdf extraction",
    installHint: buildBinaryInstallHint("poppler"),
  },
  {
    id: "pdftoppm",
    command: process.env.MIKACLI_PDFTOPPM_BIN || "pdftoppm",
    args: ["-h"],
    purpose: "editor pdf to-images rendering",
    installHint: buildBinaryInstallHint("poppler"),
  },
  {
    id: "qlmanage",
    command: process.env.MIKACLI_QLMANAGE_BIN || "qlmanage",
    args: ["-h"],
    purpose: "editor document/pdf preview rendering on macOS",
    platforms: ["darwin"],
    installHint: "qlmanage ships with macOS.",
  },
  {
    id: "textutil",
    command: process.env.MIKACLI_TEXTUTIL_BIN || "textutil",
    args: ["-help"],
    purpose: "editor document conversion",
    platforms: ["darwin"],
    installHint: "textutil ships with macOS.",
  },
  {
    id: "tesseract",
    command: process.env.MIKACLI_TESSERACT_BIN || "tesseract",
    args: ["--version"],
    purpose: "editor document OCR",
    installHint: buildBinaryInstallHint("tesseract"),
  },
  {
    id: "mdls",
    command: process.env.MIKACLI_MDLS_BIN || "mdls",
    args: ["-name", "kMDItemFSName", "."],
    purpose: "editor document metadata on macOS",
    platforms: ["darwin"],
    installHint: "mdls ships with macOS.",
  },
  {
    id: "zip",
    command: process.env.MIKACLI_ZIP_BIN || "zip",
    args: ["-v"],
    purpose: "editor archive create",
    installHint: buildBinaryInstallHint("zip"),
  },
  {
    id: "unzip",
    command: process.env.MIKACLI_UNZIP_BIN || "unzip",
    args: ["-v"],
    purpose: "editor archive extract and list",
    installHint: buildBinaryInstallHint("unzip"),
  },
  {
    id: "tar",
    command: process.env.MIKACLI_TAR_BIN || "tar",
    args: ["--version"],
    purpose: "editor archive tar flows",
    installHint: buildBinaryInstallHint("tar"),
  },
  {
    id: "gzip",
    command: process.env.MIKACLI_GZIP_BIN || "gzip",
    args: ["--version"],
    purpose: "editor archive gzip",
    installHint: buildBinaryInstallHint("gzip"),
  },
  {
    id: "gunzip",
    command: process.env.MIKACLI_GUNZIP_BIN || "gunzip",
    args: ["--version"],
    purpose: "editor archive gunzip",
    installHint: buildBinaryInstallHint("gzip"),
  },
  {
    id: "7z",
    command: process.env.MIKACLI_7Z_BIN || "7z",
    args: ["--help"],
    purpose: "editor archive 7z support",
    installHint: buildBinaryInstallHint("7z"),
  },
] as const;

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Check local MikaCLI health, saved connection state, and optional binary availability")
    .option("--fix", "Install all supported missing browser and local-tool dependencies automatically")
    .option("--strict", "Return a failing exit code for warnings too")
    .addHelpText(
      "after",
      `
Examples:
  mikacli doctor
  mikacli doctor --json
  mikacli doctor --fix
  mikacli doctor --strict
`,
    )
    .action(async function doctorAction(this: Command) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{ fix?: boolean; strict?: boolean }>();
      const initialReport = await collectDoctorReport();
      let report = initialReport;
      let fixResult: DoctorFixExecution | undefined;

      if (options.fix) {
        fixResult = await runDoctorFix(initialReport.checks, {
          json: ctx.json,
        });
        report = await collectDoctorReport();
      }

      if (ctx.json) {
        printJson({
          ok: true,
          ...(fixResult
            ? {
                fix: {
                  attempted: fixResult.attempted,
                  supported: fixResult.supported,
                  manager: fixResult.manager,
                  installed: fixResult.installed.map((target) => ({
                    id: target.id,
                    kind: target.kind,
                    packageName: target.packageName,
                    reason: target.reason,
                    checkIds: target.checkIds,
                  })),
                  failed: fixResult.failed.map((target) => ({
                    id: target.id,
                    kind: target.kind,
                    packageName: target.packageName,
                    reason: target.reason,
                    checkIds: target.checkIds,
                    error: target.error,
                  })),
                  skipped: fixResult.skipped,
                  reason: fixResult.reason,
                  before: {
                    health: initialReport.health,
                    summary: initialReport.summary,
                  },
                  after: {
                    health: report.health,
                    summary: report.summary,
                  },
                },
              }
            : {}),
          health: report.health,
          summary: report.summary,
          recommendations: report.recommendations,
          checks: report.checks,
        });
      } else {
        if (fixResult) {
          printDoctorFixSummary(fixResult);
          console.log("");
        }

        const summaryLine = `Doctor health: ${report.health}. ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail.`;
        console.log(summaryLine);
        printDoctorTable(
          report.checks.map((check) => ({
            check: `${check.category}:${check.id}`,
            status: check.status,
            message: check.message,
          })),
        );

        if (report.recommendations.length > 0) {
          console.log("");
          console.log("next:");
          for (const recommendation of report.recommendations) {
            console.log(`- ${recommendation}`);
          }
        }
      }

      if (report.health === "fail" || (options.strict && report.health === "warn")) {
        process.exitCode = 1;
      }
    });
}

export async function collectDoctorReport(connectionStore = new ConnectionStore()): Promise<DoctorReport> {
  const [directoryChecks, binaryChecks, browserChecks, connectionCheck] = await Promise.all([
    Promise.all(DIRECTORY_CHECKS.map(runDirectoryCheck)),
    Promise.all(BINARY_CHECKS.map(runBinaryCheck)),
    collectBrowserChecks(),
    runConnectionCheck(connectionStore),
  ]);

  const checks = [...directoryChecks, ...binaryChecks, ...browserChecks, connectionCheck];
  const summary = summarizeDoctorChecks(checks);

  return {
    health: summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "pass",
    summary,
    recommendations: buildDoctorRecommendations(checks, summary),
    checks,
  };
}

export function buildDoctorRecommendations(
  checks: readonly DoctorCheck[],
  summary: DoctorReport["summary"],
): string[] {
  const recommendations: string[] = [];
  const failedDirectories = checks.filter((check) => check.category === "filesystem" && check.status === "fail");
  const warnedBinaries = checks.filter((check) => check.category === "binary" && check.status === "warn");
  const browserExecutableCheck = checks.find((check) => check.id === "browser-executable");
  const browserProfileCheck = checks.find((check) => check.id === "shared-browser-profile");
  const browserRuntimeCheck = checks.find((check) => check.id === "shared-browser-runtime");
  const fixPlan = buildDoctorFixPlan(checks);

  if (failedDirectories.length > 0) {
    recommendations.push("Fix the failing MikaCLI directories first so sessions, browser state, and jobs can be saved correctly.");
  }

  if (fixPlan.supported && fixPlan.targets.length > 0) {
    recommendations.push("Run `mikacli doctor --fix` to install all supported missing browser and local-tool dependencies automatically.");
  }

  if (browserExecutableCheck && browserExecutableCheck.status !== "pass") {
    const hint = asString(browserExecutableCheck?.details?.installHint);
    recommendations.push(
      hint
        ? `Install a Chrome/Chromium browser for browser-backed actions. ${hint}`
        : "Install Chrome/Chromium or set `MIKACLI_BROWSER_PATH` so browser-backed actions can run.",
    );
  }

  if (summary.records === 0) {
    recommendations.push("Run `mikacli login --browser` or a provider-specific `login` command to save your first reusable account.");
  }

  if (browserProfileCheck?.status === "warn") {
    recommendations.push("Run `mikacli login --browser` once to create the shared MikaCLI browser profile before using browser-backed actions.");
  }

  if (browserRuntimeCheck?.status === "warn" && asString(browserRuntimeCheck?.details?.state) === "stale") {
    recommendations.push("A stale shared browser state file was detected. Re-run `mikacli login --browser` to refresh the managed browser state.");
  }

  if (summary.expired > 0) {
    recommendations.push("Inspect expired records with `mikacli sessions --status expired` and refresh them with the provider's `login` command.");
  }

  if (warnedBinaries.length > 0) {
    const installHints = dedupeStrings(
      warnedBinaries
        .map((check) => asString(check.details?.installHint))
        .filter((value): value is string => Boolean(value)),
    );

    if (installHints.length > 0) {
      for (const hint of installHints.slice(0, 4)) {
        recommendations.push(hint);
      }
    } else {
      recommendations.push("Install the missing local binaries if you want the related editor/document commands to work fully.");
    }
  }

  if (summary.unknown > 0 && summary.records > 0) {
    recommendations.push("Use `mikacli sessions` to review saved records that still have unknown validation state.");
  }

  return dedupeStrings(recommendations);
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
      message: `${input.label} does not exist yet. MikaCLI will create it on first use.`,
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
  if (Array.isArray(input.platforms) && !input.platforms.includes(process.platform)) {
    return {
      id: input.id,
      category: "binary",
      status: "pass",
      message: `${input.command} is only needed on ${formatSupportedPlatforms(input.platforms)}.`,
      details: {
        command: input.command,
        args: input.args,
        purpose: input.purpose,
        skippedOnPlatform: process.platform,
      },
    };
  }

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
      installHint: input.installHint,
      ...(result.error ? { error: result.error } : {}),
    },
  };
}

async function collectBrowserChecks(): Promise<DoctorCheck[]> {
  const [executableCheck, profileCheck, runtimeCheck] = await Promise.all([
    runBrowserExecutableCheck(),
    runBrowserProfileCheck(),
    runSharedBrowserRuntimeCheck(),
  ]);

  return [executableCheck, profileCheck, runtimeCheck];
}

async function runBrowserExecutableCheck(): Promise<DoctorCheck> {
  const probe = await probeBrowserExecutable();
  const installHint = buildBrowserInstallHint();

  if (probe.available) {
    return {
      id: "browser-executable",
      category: "browser",
      status: "pass",
      message: `${probe.path} is available for shared-browser login and browser-backed actions.`,
      details: {
        path: probe.path,
        source: probe.source,
      },
    };
  }

  return {
    id: "browser-executable",
    category: "browser",
    status: probe.source === "env" ? "fail" : "warn",
    message: probe.error ?? "Could not find a Chrome or Chromium executable.",
    details: {
      source: probe.source,
      path: probe.path,
      candidates: probe.candidates,
      installHint,
    },
  };
}

async function runBrowserProfileCheck(): Promise<DoctorCheck> {
  const profilePath = getBrowserProfileDir(DEFAULT_BROWSER_PROFILE);
  const exists = await hasAccess(profilePath, constants.F_OK);
  if (!exists) {
    return {
      id: "shared-browser-profile",
      category: "browser",
      status: "warn",
      message: "The default shared MikaCLI browser profile has not been created yet.",
      details: {
        path: profilePath,
        profile: DEFAULT_BROWSER_PROFILE,
      },
    };
  }

  const writable = await hasAccess(profilePath, constants.R_OK | constants.W_OK);
  return {
    id: "shared-browser-profile",
    category: "browser",
    status: writable ? "pass" : "fail",
    message: writable
      ? "The default shared MikaCLI browser profile is ready."
      : "The default shared MikaCLI browser profile exists but is not writable.",
    details: {
      path: profilePath,
      profile: DEFAULT_BROWSER_PROFILE,
    },
  };
}

async function runSharedBrowserRuntimeCheck(): Promise<DoctorCheck> {
  const statePath = getBrowserStatePath(DEFAULT_BROWSER_PROFILE);
  const exists = await hasAccess(statePath, constants.F_OK);
  if (!exists) {
    return {
      id: "shared-browser-runtime",
      category: "browser",
      status: "pass",
      message: "The shared MikaCLI browser is currently stopped.",
      details: {
        state: "stopped",
        profile: DEFAULT_BROWSER_PROFILE,
        statePath,
      },
    };
  }

  const state = await readManagedBrowserState(DEFAULT_BROWSER_PROFILE);
  if (!state) {
    return {
      id: "shared-browser-runtime",
      category: "browser",
      status: "warn",
      message: "The shared browser state file is present but could not be parsed.",
      details: {
        state: "invalid",
        profile: DEFAULT_BROWSER_PROFILE,
        statePath,
      },
    };
  }

  if (!isProcessAlive(state.pid)) {
    return {
      id: "shared-browser-runtime",
      category: "browser",
      status: "warn",
      message: "The shared browser state file is stale. MikaCLI does not see the recorded browser process anymore.",
      details: {
        state: "stale",
        profile: DEFAULT_BROWSER_PROFILE,
        statePath,
        pid: state.pid,
      },
    };
  }

  return {
    id: "shared-browser-runtime",
    category: "browser",
    status: "pass",
    message: "The shared MikaCLI browser is running and ready to reuse.",
    details: {
      state: "running",
      profile: DEFAULT_BROWSER_PROFILE,
      statePath,
      pid: state.pid,
      cdpUrl: state.cdpUrl,
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

export function buildDoctorFixPlan(
  checks: readonly DoctorCheck[],
  platform: NodeJS.Platform = process.platform,
): DoctorFixPlan {
  const missingBinaryChecks = checks.filter((check) => check.category === "binary" && check.status === "warn");
  const missingBrowserCheck = checks.find((check) => check.id === "browser-executable" && check.status !== "pass");

  if (platform !== "darwin") {
    return {
      supported: false,
      targets: [],
      skipped: [...missingBinaryChecks, ...(missingBrowserCheck ? [missingBrowserCheck] : [])].map((check) => ({
        id: check.id,
        reason: "Automatic installs are currently only implemented on macOS with Homebrew.",
      })),
      reason: "Automatic installs are currently only implemented on macOS with Homebrew.",
    };
  }

  const targets = new Map<string, DoctorFixTarget>();
  const skipped: DoctorFixPlan["skipped"] = [];

  const registerTarget = (target: DoctorFixTarget) => {
    const key = `${target.kind}:${target.packageName}`;
    const existing = targets.get(key);
    if (existing) {
      existing.checkIds = dedupeStrings([...existing.checkIds, ...target.checkIds]);
      return;
    }
    targets.set(key, target);
  };

  if (missingBrowserCheck) {
    registerTarget({
      id: "browser-executable",
      kind: "brew-cask",
      packageName: "google-chrome",
      reason: "Chrome/Chromium is needed for shared-browser login and browser-backed actions.",
      checkIds: ["browser-executable"],
    });
  }

  for (const check of missingBinaryChecks) {
    switch (check.id) {
      case "ffmpeg":
      case "ffprobe":
      case "ffplay":
        registerTarget({
          id: "ffmpeg",
          kind: "brew",
          packageName: "ffmpeg",
          reason: "Installs FFmpeg, ffprobe, and ffplay for media workflows.",
          checkIds: [check.id],
        });
        break;
      case "yt-dlp":
        registerTarget({
          id: "yt-dlp",
          kind: "brew",
          packageName: "yt-dlp",
          reason: "Installs yt-dlp for YouTube and YouTube Music downloads.",
          checkIds: [check.id],
        });
        break;
      case "qpdf":
        registerTarget({
          id: "qpdf",
          kind: "brew",
          packageName: "qpdf",
          reason: "Installs qpdf for advanced PDF actions.",
          checkIds: [check.id],
        });
        break;
      case "pdftotext":
      case "pdftoppm":
        registerTarget({
          id: "poppler",
          kind: "brew",
          packageName: "poppler",
          reason: "Installs Poppler tools for PDF text extraction and rendering.",
          checkIds: [check.id],
        });
        break;
      case "tesseract":
        registerTarget({
          id: "tesseract",
          kind: "brew",
          packageName: "tesseract",
          reason: "Installs Tesseract OCR for document recognition.",
          checkIds: [check.id],
        });
        break;
      case "7z":
        registerTarget({
          id: "7z",
          kind: "brew",
          packageName: "p7zip",
          reason: "Installs 7-Zip support for archive workflows.",
          checkIds: [check.id],
        });
        break;
      case "zip":
      case "unzip":
      case "tar":
      case "gzip":
      case "gunzip":
        skipped.push({
          id: check.id,
          reason: "This archive utility is not auto-installed by `doctor --fix`. Install Xcode Command Line Tools or your preferred package manager if needed.",
        });
        break;
      default:
        skipped.push({
          id: check.id,
          reason: "This dependency does not have an automatic install target yet.",
        });
        break;
    }
  }

  return {
    supported: true,
    manager: "brew",
    targets: [...targets.values()],
    skipped,
  };
}

async function runDoctorFix(
  checks: readonly DoctorCheck[],
  options: {
    json: boolean;
  },
): Promise<DoctorFixExecution> {
  const plan = buildDoctorFixPlan(checks);

  if (!plan.supported) {
    return {
      attempted: false,
      supported: false,
      installed: [],
      failed: [],
      skipped: plan.skipped,
      reason: plan.reason,
    };
  }

  if (plan.targets.length === 0) {
    return {
      attempted: false,
      supported: true,
      manager: plan.manager,
      installed: [],
      failed: [],
      skipped: plan.skipped,
      reason: "No supported missing dependencies need to be installed.",
    };
  }

  const brewProbe = await probeBinary("brew", ["--version"]);
  if (!brewProbe.available) {
    return {
      attempted: false,
      supported: true,
      manager: "brew",
      installed: [],
      failed: [],
      skipped: [
        ...plan.skipped,
        ...plan.targets.map((target) => ({
          id: target.id,
          reason: "Homebrew is required for `mikacli doctor --fix` on macOS. Install Homebrew first, then retry.",
        })),
      ],
      reason: "Homebrew is required for automatic installs on macOS.",
    };
  }

  const installed: DoctorFixTarget[] = [];
  const failed: DoctorFixExecution["failed"] = [];

  const brewTargets = plan.targets.filter((target) => target.kind === "brew");
  const brewCaskTargets = plan.targets.filter((target) => target.kind === "brew-cask");

  if (brewTargets.length > 0) {
    const result = await runInstallCommand(
      "brew",
      ["install", ...brewTargets.map((target) => target.packageName)],
      options.json,
    );

    if (result.ok) {
      installed.push(...brewTargets);
    } else {
      for (const target of brewTargets) {
        failed.push({
          ...target,
          error: result.error,
        });
      }
    }
  }

  if (brewCaskTargets.length > 0) {
    const result = await runInstallCommand(
      "brew",
      ["install", "--cask", ...brewCaskTargets.map((target) => target.packageName)],
      options.json,
    );

    if (result.ok) {
      installed.push(...brewCaskTargets);
    } else {
      for (const target of brewCaskTargets) {
        failed.push({
          ...target,
          error: result.error,
        });
      }
    }
  }

  return {
    attempted: installed.length > 0 || failed.length > 0,
    supported: true,
    manager: "brew",
    installed,
    failed,
    skipped: plan.skipped,
    ...(failed.length > 0 ? { reason: "Some packages could not be installed automatically." } : {}),
  };
}

async function runInstallCommand(
  command: string,
  args: string[],
  jsonMode: boolean,
): Promise<{ ok: boolean; error: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: jsonMode ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let stdout = "";
    let stderr = "";

    if (jsonMode && child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (jsonMode && child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", (error) => {
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          error: "",
        });
        return;
      }

      const detail = compactInstallError(stderr || stdout) || `Command exited with code ${code ?? "unknown"}.`;
      resolve({
        ok: false,
        error: detail,
      });
    });
  });
}

function compactInstallError(text: string): string {
  const normalized = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6)
    .join(" ");
  return normalized;
}

function printDoctorFixSummary(result: DoctorFixExecution): void {
  if (!result.supported) {
    console.log(`doctor --fix: ${result.reason ?? "Automatic installs are not supported on this platform."}`);
    return;
  }

  if (!result.attempted && result.installed.length === 0 && result.failed.length === 0) {
    console.log(`doctor --fix: ${result.reason ?? "Nothing supported needed to be installed."}`);
    return;
  }

  const parts = [
    `installed ${result.installed.length}`,
    `failed ${result.failed.length}`,
    `skipped ${result.skipped.length}`,
  ];
  console.log(`doctor --fix (${result.manager ?? "auto"}): ${parts.join(", ")}.`);

  for (const target of result.installed) {
    console.log(`- installed ${target.packageName} (${target.reason})`);
  }

  for (const target of result.failed) {
    console.log(`- failed ${target.packageName}: ${target.error}`);
  }

  for (const target of result.skipped) {
    console.log(`- skipped ${target.id}: ${target.reason}`);
  }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

async function readManagedBrowserState(profile: string): Promise<{
  pid: number;
  cdpUrl: string;
} | null> {
  try {
    const raw = await readFile(getBrowserStatePath(profile), "utf8");
    const parsed = JSON.parse(raw) as Partial<{ pid: number; cdpUrl: string }>;
    if (typeof parsed.pid === "number" && typeof parsed.cdpUrl === "string") {
      return {
        pid: parsed.pid,
        cdpUrl: parsed.cdpUrl,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function formatSupportedPlatforms(platforms: readonly NodeJS.Platform[]): string {
  return platforms.map(formatPlatformName).join(" or ");
}

function formatPlatformName(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "macOS";
    case "win32":
      return "Windows";
    default:
      return platform;
  }
}

function buildBrowserInstallHint(): string {
  if (process.platform === "darwin") {
    return "Install Google Chrome or Chromium, then re-run `mikacli doctor`. You can also set `MIKACLI_BROWSER_PATH` to a custom browser binary.";
  }

  if (process.platform === "win32") {
    return "Install Google Chrome or Chromium, or set `MIKACLI_BROWSER_PATH` to the browser executable.";
  }

  return "Install Chrome/Chromium with your package manager, or set `MIKACLI_BROWSER_PATH` to the browser executable.";
}

function buildBinaryInstallHint(id: string): string {
  if (process.platform === "darwin") {
    switch (id) {
      case "ffmpeg":
        return "Install FFmpeg with `brew install ffmpeg`.";
      case "yt-dlp":
        return "Install yt-dlp with `brew install yt-dlp`.";
      case "qpdf":
        return "Install qpdf with `brew install qpdf`.";
      case "poppler":
        return "Install Poppler tools with `brew install poppler`.";
      case "tesseract":
        return "Install Tesseract with `brew install tesseract`.";
      case "7z":
        return "Install 7-Zip support with `brew install p7zip`.";
      case "zip":
      case "unzip":
      case "tar":
      case "gzip":
        return "Install the missing archive utility with Xcode Command Line Tools or your preferred package manager.";
      default:
        return "Install the missing dependency and rerun `mikacli doctor`.";
    }
  }

  if (process.platform === "win32") {
    switch (id) {
      case "ffmpeg":
        return "Install FFmpeg, for example with `winget install Gyan.FFmpeg`.";
      case "yt-dlp":
        return "Install yt-dlp, for example with `winget install yt-dlp.yt-dlp`.";
      default:
        return "Install the missing dependency and rerun `mikacli doctor`.";
    }
  }

  switch (id) {
    case "ffmpeg":
      return "Install FFmpeg with your package manager, for example `sudo apt install ffmpeg`.";
    case "yt-dlp":
      return "Install yt-dlp with your package manager, for example `sudo apt install yt-dlp`.";
    case "qpdf":
      return "Install qpdf with your package manager.";
    case "poppler":
      return "Install Poppler tools with your package manager.";
    case "tesseract":
      return "Install Tesseract OCR with your package manager.";
    case "7z":
      return "Install 7-Zip support with your package manager.";
    default:
      return "Install the missing dependency and rerun `mikacli doctor`.";
  }
}
