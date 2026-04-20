import { mkdir, copyFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Command } from "commander";

import { MediaJobStore, matchesMediaJobTarget, type MediaJobRecord, type MediaJobState } from "../core/media-jobs/store.js";
import { normalizeActionResult } from "../core/runtime/login-result.js";
import { MikaCliError } from "../errors.js";
import { Logger } from "../logger.js";
import { isPlatform, PLATFORM_NAMES } from "../platforms/config.js";
import { getPlatformDefinition, getPlatformDefinitions } from "../platforms/index.js";
import { resolveCommandContext, runCommandAction } from "../utils/cli.js";
import { printMediaJobActionResult } from "../utils/media-job-output.js";
import { printJson, printMediaJobsTable } from "../utils/output.js";

import type { PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { AdapterActionResult, Platform } from "../types.js";

const DEFAULT_WATCH_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_WATCH_INTERVAL_MS = 5 * 1000;

type JobListOptions = {
  platform?: string;
  status?: string;
  kind?: string;
  account?: string;
  limit?: number;
};

export type SavedMediaJob = {
  job: MediaJobRecord;
  path: string;
  displayName: string;
  availableActions: {
    watch: boolean;
    download: boolean;
    cancel: boolean;
  };
};

export type MediaJobSummary = {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  canceled: number;
  unknown: number;
};

type ImageDownloadCapableAdapter = {
  imageDownload(input: {
    account?: string;
    target: string;
    outputDir?: string;
  }): Promise<AdapterActionResult>;
};

type VideoDownloadCapableAdapter = {
  videoDownload(input: {
    account?: string;
    target: string;
    outputDir?: string;
  }): Promise<AdapterActionResult>;
};

type VideoWaitCapableAdapter = {
  videoWait(input: {
    account?: string;
    target: string;
    timeoutMs?: number;
    intervalMs?: number;
  }): Promise<AdapterActionResult>;
};

type VideoCancelCapableAdapter = {
  videoCancel(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult>;
};

export function createJobsCommand(): Command {
  const command = new Command("jobs")
    .description("Inspect and manage saved media and async jobs")
    .option("--platform <platform>", "Filter by platform id")
    .option("--status <status>", "Filter by status: queued, processing, completed, failed, canceled, unknown")
    .option("--kind <kind>", "Filter by saved job kind, for example image or video")
    .option("--account <name>", "Filter by saved account name")
    .option("--limit <count>", "Maximum rows to return (default: 20)", parsePositiveInteger, 20)
    .addHelpText(
      "after",
      `
Examples:
  mikacli jobs
  mikacli jobs --platform grok
  mikacli jobs show job_ab12
  mikacli jobs watch job_ab12
  mikacli jobs download job_ab12 --output-dir ./renders
  mikacli jobs cancel job_ab12 --platform grok
`,
    )
    .action(async function jobsListAction(this: Command) {
      await handleJobsList(this);
    });

  command
    .command("list")
    .description("List saved jobs")
    .option("--platform <platform>", "Filter by platform id")
    .option("--status <status>", "Filter by status: queued, processing, completed, failed, canceled, unknown")
    .option("--kind <kind>", "Filter by saved job kind, for example image or video")
    .option("--account <name>", "Filter by saved account name")
    .option("--limit <count>", "Maximum rows to return (default: 20)", parsePositiveInteger, 20)
    .action(async function jobsListCommandAction(this: Command) {
      await handleJobsList(this);
    });

  command
    .command("show")
    .description("Show one saved job by job id or provider target")
    .argument("<target>", "Saved job id, provider job id, conversation id, or response id")
    .option("--platform <platform>", "Optional platform id when the target is not globally unique")
    .action(async function jobsShowAction(this: Command, target: string) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{ platform?: string }>();
      const entry = await findSavedMediaJob({
        target,
        platform: normalizeJobPlatform(options.platform),
      });

      if (ctx.json) {
        printJson({
          ok: true,
          job: serializeSavedMediaJob(entry),
        });
        return;
      }

      printSavedMediaJobDetail(entry);
    });

  command
    .command("watch")
    .description("Wait for a saved job to reach a terminal state")
    .argument("<target>", "Saved job id, provider job id, conversation id, or response id")
    .option("--platform <platform>", "Optional platform id when the target is not globally unique")
    .option("--timeout <seconds>", "Maximum seconds to wait before returning (default: 600)", parsePositiveInteger)
    .option("--interval <seconds>", "Polling interval in seconds when using the saved-job fallback (default: 5)", parsePositiveInteger)
    .action(async function jobsWatchAction(this: Command, target: string) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{
        platform?: string;
        timeout?: number;
        interval?: number;
      }>();
      const entry = await findSavedMediaJob({
        target,
        platform: normalizeJobPlatform(options.platform),
      });

      const timeoutMs = (options.timeout ?? DEFAULT_WATCH_TIMEOUT_MS / 1000) * 1000;
      const intervalMs = (options.interval ?? DEFAULT_WATCH_INTERVAL_MS / 1000) * 1000;

      if (isTerminalMediaJobState(entry.job.status)) {
        const result = normalizeActionResult(
          buildStoredMediaJobActionResult(entry, "watch", `${entry.displayName} ${entry.job.kind} job ${entry.job.jobId} is already ${entry.job.status}. No further polling needed.`),
          getPlatformDefinition(entry.job.platform),
          "watch",
        );
        printMediaJobActionResult(result, ctx.json);
        return;
      }

      const definition = getPlatformDefinition(entry.job.platform);
      const adapter = definition?.adapter;

      if (entry.job.kind === "video" && hasVideoWaitAdapter(adapter)) {
        const logger = new Logger(ctx);
        const spinner = logger.spinner(`Waiting for saved ${entry.displayName} video job...`);
        await runCommandAction({
          spinner,
          successMessage: `${entry.displayName} video job watch completed.`,
          action: () =>
            adapter.videoWait({
              account: entry.job.account,
              target: entry.job.jobId,
              timeoutMs,
              intervalMs,
            }),
          onSuccess: (result) => {
            printMediaJobActionResult(normalizeActionResult(result, definition, result.action), ctx.json);
          },
        });
        return;
      }

      const watched = await waitForStoredMediaJob({
        store: new MediaJobStore(),
        platform: entry.job.platform,
        jobId: entry.job.jobId,
        timeoutMs,
        intervalMs,
      });

      const result = normalizeActionResult(
        buildStoredMediaJobActionResult(watched, "watch", `${watched.displayName} ${watched.job.kind} job ${watched.job.jobId} reached ${watched.job.status}.`),
        getPlatformDefinition(watched.job.platform),
        "watch",
      );
      printMediaJobActionResult(result, ctx.json);
    });

  command
    .command("download")
    .description("Download or reopen a saved job output")
    .argument("<target>", "Saved job id, provider job id, conversation id, or response id")
    .option("--platform <platform>", "Optional platform id when the target is not globally unique")
    .option("--output-dir <path>", "Directory to write the downloaded output into")
    .action(async function jobsDownloadAction(this: Command, target: string) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{
        platform?: string;
        outputDir?: string;
      }>();
      const entry = await findSavedMediaJob({
        target,
        platform: normalizeJobPlatform(options.platform),
      });

      const definition = getPlatformDefinition(entry.job.platform);
      const adapter = definition?.adapter;
      const logger = new Logger(ctx);
      const spinner = logger.spinner(`Loading saved ${entry.displayName} ${entry.job.kind} job output...`);

      if (entry.job.kind === "image" && hasImageDownloadAdapter(adapter)) {
        await runCommandAction({
          spinner,
          successMessage: `${entry.displayName} image download completed.`,
          action: () =>
            adapter.imageDownload({
              account: entry.job.account,
              target: entry.job.jobId,
              outputDir: options.outputDir,
            }),
          onSuccess: (result) => {
            printMediaJobActionResult(normalizeActionResult(result, definition, result.action), ctx.json);
          },
        });
        return;
      }

      if (entry.job.kind === "video" && hasVideoDownloadAdapter(adapter)) {
        await runCommandAction({
          spinner,
          successMessage: `${entry.displayName} video download completed.`,
          action: () =>
            adapter.videoDownload({
              account: entry.job.account,
              target: entry.job.jobId,
              outputDir: options.outputDir,
            }),
          onSuccess: (result) => {
            printMediaJobActionResult(normalizeActionResult(result, definition, result.action), ctx.json);
          },
        });
        return;
      }

      const fallback = await reopenSavedMediaJob(entry, options.outputDir);
      printMediaJobActionResult(
        normalizeActionResult(fallback, definition, fallback.action),
        ctx.json,
      );
    });

  command
    .command("cancel")
    .description("Request cancellation for a currently inflight saved job when the provider supports it")
    .argument("<target>", "Saved job id, provider job id, conversation id, or response id")
    .option("--platform <platform>", "Optional platform id when the target is not globally unique")
    .action(async function jobsCancelAction(this: Command, target: string) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{ platform?: string }>();
      const entry = await findSavedMediaJob({
        target,
        platform: normalizeJobPlatform(options.platform),
      });

      if (isTerminalMediaJobState(entry.job.status)) {
        const result = normalizeActionResult(
          buildStoredMediaJobActionResult(entry, "cancel", `${entry.displayName} ${entry.job.kind} job ${entry.job.jobId} is already ${entry.job.status}; nothing to cancel.`),
          getPlatformDefinition(entry.job.platform),
          "cancel",
        );
        printMediaJobActionResult(result, ctx.json);
        return;
      }

      const definition = getPlatformDefinition(entry.job.platform);
      const adapter = definition?.adapter;
      if (!(entry.job.kind === "video" && hasVideoCancelAdapter(adapter))) {
        throw unsupportedJobActionError(entry, "cancel");
      }

      const logger = new Logger(ctx);
      const spinner = logger.spinner(`Requesting cancellation for saved ${entry.displayName} video job...`);
      await runCommandAction({
        spinner,
        successMessage: `${entry.displayName} video cancellation request completed.`,
        action: () =>
          adapter.videoCancel({
            account: entry.job.account,
            target: entry.job.jobId,
          }),
        onSuccess: (result) => {
          printMediaJobActionResult(normalizeActionResult(result, definition, result.action), ctx.json);
        },
      });
    });

  return command;
}

async function handleJobsList(command: Command): Promise<void> {
  const ctx = resolveCommandContext(command);
  const options = command.optsWithGlobals<JobListOptions>();
  const entries = await listSavedMediaJobs({
    platform: normalizeJobPlatform(options.platform),
    status: normalizeMediaJobState(options.status),
    kind: normalizeJobKind(options.kind),
    account: options.account,
    limit: options.limit ?? 20,
  });
  const summary = summarizeMediaJobs(entries);

  if (ctx.json) {
    printJson({
      ok: true,
      summary,
      jobs: entries.map((entry) => serializeSavedMediaJob(entry)),
    });
    return;
  }

  console.log(
    `Saved jobs: ${summary.total}. ${summary.completed} completed, ${summary.processing} processing, ${summary.failed} failed, ${summary.canceled} canceled, ${summary.queued} queued, ${summary.unknown} unknown.`,
  );
  printMediaJobsTable(
    entries.map((entry) => ({
      platform: entry.job.platform,
      account: entry.job.account,
      kind: entry.job.kind,
      status: entry.job.status,
      updated: formatJobListTimestamp(entry.job.updatedAt),
      jobId: entry.job.jobId,
      message: entry.job.message,
    })),
  );
}

export async function listSavedMediaJobs(input: {
  platform?: Platform;
  status?: MediaJobState;
  kind?: string;
  account?: string;
  limit?: number;
  store?: MediaJobStore;
  platforms?: readonly Platform[];
} = {}): Promise<SavedMediaJob[]> {
  const store = input.store ?? new MediaJobStore();
  const platforms = input.platform ? [input.platform] : [...(input.platforms ?? PLATFORM_NAMES)];
  const nested = await Promise.all(
    platforms.map(async (platform) => {
      const entries = await store.listJobs(platform, {
        kind: input.kind,
        account: input.account,
      });
      return entries
        .filter((entry) => !input.status || entry.job.status === input.status)
        .map((entry) => toSavedMediaJobEntry(entry));
    }),
  );

  const jobs = nested
    .flat()
    .sort((left, right) => right.job.updatedAt.localeCompare(left.job.updatedAt));

  if (!input.limit || input.limit <= 0) {
    return jobs;
  }

  return jobs.slice(0, input.limit);
}

export async function findSavedMediaJob(input: {
  target: string;
  platform?: Platform;
  store?: MediaJobStore;
  platforms?: readonly Platform[];
}): Promise<SavedMediaJob> {
  const target = input.target.trim();
  if (!target) {
    throw new MikaCliError("INVALID_TARGET", "Expected a saved job id or provider job target.");
  }

  const entries = await listSavedMediaJobs({
    platform: input.platform,
    limit: undefined,
    store: input.store,
    platforms: input.platforms,
  });
  const matches = entries.filter((entry) => matchesMediaJobTarget(entry.job, target));
  const exactJobIdMatches = matches.filter((entry) => entry.job.jobId === target);
  const preferred = exactJobIdMatches.length > 0 ? exactJobIdMatches : matches;

  if (preferred.length === 0) {
    throw new MikaCliError("MEDIA_JOB_NOT_FOUND", `No saved job was found for "${target}".`, {
      details: {
        target,
        ...(input.platform ? { platform: input.platform } : {}),
      },
    });
  }

  if (preferred.length > 1) {
    throw new MikaCliError("MEDIA_JOB_AMBIGUOUS", `Multiple saved jobs matched "${target}". Re-run with --platform.`, {
      details: {
        target,
        matches: preferred.map((entry) => ({
          platform: entry.job.platform,
          kind: entry.job.kind,
          account: entry.job.account,
          jobId: entry.job.jobId,
        })),
      },
    });
  }

  return preferred[0]!;
}

export async function waitForStoredMediaJob(input: {
  platform: Platform;
  jobId: string;
  store?: MediaJobStore;
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<SavedMediaJob> {
  const store = input.store ?? new MediaJobStore();
  const timeoutMs = input.timeoutMs ?? DEFAULT_WATCH_TIMEOUT_MS;
  const intervalMs = input.intervalMs ?? DEFAULT_WATCH_INTERVAL_MS;
  const sleep = input.sleep ?? defaultSleep;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const current = await store.loadJob(input.platform, input.jobId);
    const entry = toSavedMediaJobEntry(current);
    if (isTerminalMediaJobState(entry.job.status)) {
      return entry;
    }

    if (Date.now() >= deadline) {
      throw new MikaCliError(
        "MEDIA_JOB_TIMEOUT",
        `Timed out waiting for saved ${entry.displayName} ${entry.job.kind} job ${entry.job.jobId}.`,
        {
          details: {
            platform: entry.job.platform,
            jobId: entry.job.jobId,
            status: entry.job.status,
            timeoutSeconds: Math.ceil(timeoutMs / 1000),
          },
        },
      );
    }

    await sleep(intervalMs);
  }
}

export function summarizeMediaJobs(entries: readonly SavedMediaJob[]): MediaJobSummary {
  const summary: MediaJobSummary = {
    total: entries.length,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    canceled: 0,
    unknown: 0,
  };

  for (const entry of entries) {
    summary[entry.job.status] += 1;
  }

  return summary;
}

function toSavedMediaJobEntry(entry: { job: MediaJobRecord; path: string }): SavedMediaJob {
  const definition = getPlatformDefinition(entry.job.platform);
  return {
    ...entry,
    displayName: definition?.displayName ?? entry.job.platform,
    availableActions: {
      watch: isTerminalMediaJobState(entry.job.status) || (entry.job.kind === "video" && hasVideoWaitAdapter(definition?.adapter)),
      download:
        (entry.job.kind === "image" && hasImageDownloadAdapter(definition?.adapter))
        || (entry.job.kind === "video" && hasVideoDownloadAdapter(definition?.adapter))
        || (entry.job.outputPaths?.length ?? 0) > 0,
      cancel: entry.job.kind === "video" && hasVideoCancelAdapter(definition?.adapter),
    },
  };
}

async function reopenSavedMediaJob(entry: SavedMediaJob, outputDir?: string): Promise<AdapterActionResult> {
  const existingPaths = entry.job.outputPaths ?? [];
  if (existingPaths.length === 0) {
    throw unsupportedJobActionError(entry, "download");
  }

  let outputPaths = existingPaths;
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
    outputPaths = await Promise.all(
      existingPaths.map(async (sourcePath) => {
        const destinationPath = join(outputDir, basename(sourcePath));
        await copyFile(sourcePath, destinationPath);
        return destinationPath;
      }),
    );
  }

  return buildStoredMediaJobActionResult(
    {
      ...entry,
      job: {
        ...entry.job,
        outputPaths,
      },
    },
    outputDir ? "download" : "reopen",
    outputDir
      ? `Copied ${outputPaths.length} saved ${entry.displayName} ${entry.job.kind} output${outputPaths.length === 1 ? "" : "s"}.`
      : `Loaded the saved ${entry.displayName} ${entry.job.kind} outputs.`,
  );
}

export function buildStoredMediaJobActionResult(
  entry: SavedMediaJob,
  action: string,
  message: string,
): AdapterActionResult {
  return {
    ok: true,
    platform: entry.job.platform,
    account: entry.job.account,
    action,
    message,
    ...(entry.job.responseId ? { id: entry.job.responseId } : {}),
    data: {
      jobId: entry.job.jobId,
      jobPath: entry.path,
      status: entry.job.status,
      ...(readStringMetadata(entry.job.metadata, "model") ? { model: readStringMetadata(entry.job.metadata, "model") } : {}),
      ...(entry.job.conversationId ? { conversationId: entry.job.conversationId } : {}),
      ...(entry.job.responseId ? { responseId: entry.job.responseId } : {}),
      ...(entry.job.providerJobId ? { providerJobId: entry.job.providerJobId } : {}),
      ...(readStringMetadata(entry.job.metadata, "outputText") ? { outputText: readStringMetadata(entry.job.metadata, "outputText") } : {}),
      ...(typeof readNumberMetadata(entry.job.metadata, "progress") === "number"
        ? { progress: readNumberMetadata(entry.job.metadata, "progress") }
        : {}),
      ...(entry.job.outputUrl ? { outputUrl: entry.job.outputUrl } : {}),
      ...(entry.job.outputUrls ? { outputUrls: entry.job.outputUrls } : {}),
      ...(entry.job.outputPaths ? { outputPaths: entry.job.outputPaths } : {}),
    },
  };
}

function printSavedMediaJobDetail(entry: SavedMediaJob): void {
  console.log(`Loaded saved job ${entry.job.jobId}.`);
  console.log(`platform: ${entry.job.platform}`);
  console.log(`account: ${entry.job.account}`);
  console.log(`kind: ${entry.job.kind}`);
  console.log(`status: ${entry.job.status}`);
  console.log(`created: ${entry.job.createdAt}`);
  console.log(`updated: ${entry.job.updatedAt}`);
  console.log(`job-file: ${entry.path}`);

  if (entry.job.message) {
    console.log(`message: ${entry.job.message}`);
  }
  if (entry.job.prompt) {
    console.log(`prompt: ${entry.job.prompt}`);
  }

  const model = readStringMetadata(entry.job.metadata, "model");
  if (model) {
    console.log(`model: ${model}`);
  }
  if (entry.job.providerJobId) {
    console.log(`provider-job: ${entry.job.providerJobId}`);
  }
  if (entry.job.conversationId) {
    console.log(`conversation: ${entry.job.conversationId}`);
  }
  if (entry.job.responseId) {
    console.log(`response: ${entry.job.responseId}`);
  }

  const progress = readNumberMetadata(entry.job.metadata, "progress");
  if (typeof progress === "number") {
    console.log(`progress: ${progress}`);
  }

  const outputText = readStringMetadata(entry.job.metadata, "outputText");
  if (outputText) {
    console.log("");
    console.log(outputText);
  }

  for (const outputPath of entry.job.outputPaths ?? []) {
    console.log(`file: ${outputPath}`);
  }
  if (entry.job.outputUrl) {
    console.log(`output: ${entry.job.outputUrl}`);
  } else {
    for (const outputUrl of entry.job.outputUrls ?? []) {
      console.log(`output: ${outputUrl}`);
    }
  }

  const actions = [
    "show",
    ...(entry.availableActions.watch ? ["watch"] : []),
    ...(entry.availableActions.download ? ["download"] : []),
    ...(entry.availableActions.cancel ? ["cancel"] : []),
  ];
  console.log(`actions: ${actions.join(", ")}`);
}

function serializeSavedMediaJob(entry: SavedMediaJob): Record<string, unknown> {
  return {
    ...entry.job,
    path: entry.path,
    displayName: entry.displayName,
    availableActions: entry.availableActions,
  };
}

function normalizeJobPlatform(value: string | undefined): Platform | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (!isPlatform(normalized)) {
    throw new MikaCliError("INVALID_PLATFORM", `Expected a valid platform id, received "${value}".`);
  }

  return normalized;
}

function normalizeMediaJobState(value: string | undefined): MediaJobState | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "queued"
    || normalized === "processing"
    || normalized === "completed"
    || normalized === "failed"
    || normalized === "canceled"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  throw new MikaCliError(
    "INVALID_JOB_STATUS",
    `Expected job status to be queued, processing, completed, failed, canceled, or unknown, received "${value}".`,
  );
}

function normalizeJobKind(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new MikaCliError("INVALID_JOB_LIMIT", `Expected a positive integer, received "${value}".`);
  }

  return parsed;
}

function formatJobListTimestamp(value: string): string {
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

function isTerminalMediaJobState(status: MediaJobState): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

function hasImageDownloadAdapter(value: unknown): value is ImageDownloadCapableAdapter {
  return Boolean(value) && typeof (value as { imageDownload?: unknown }).imageDownload === "function";
}

function hasVideoDownloadAdapter(value: unknown): value is VideoDownloadCapableAdapter {
  return Boolean(value) && typeof (value as { videoDownload?: unknown }).videoDownload === "function";
}

function hasVideoWaitAdapter(value: unknown): value is VideoWaitCapableAdapter {
  return Boolean(value) && typeof (value as { videoWait?: unknown }).videoWait === "function";
}

function hasVideoCancelAdapter(value: unknown): value is VideoCancelCapableAdapter {
  return Boolean(value) && typeof (value as { videoCancel?: unknown }).videoCancel === "function";
}

function unsupportedJobActionError(entry: SavedMediaJob, action: "download" | "cancel"): MikaCliError {
  const definition = getPlatformDefinition(entry.job.platform);
  const prefix = definition
    ? buildPlatformCommandPrefix(definition)
    : `mikacli ${entry.job.platform}`;
  const providerHint =
    action === "download"
      ? entry.job.kind === "image"
        ? `${prefix} image-download ${entry.job.jobId}`
        : `${prefix} video-download ${entry.job.jobId}`
      : `${prefix} video-cancel ${entry.job.jobId}`;

  return new MikaCliError(
    action === "download" ? "MEDIA_JOB_DOWNLOAD_UNSUPPORTED" : "MEDIA_JOB_CANCEL_UNSUPPORTED",
    `${entry.displayName} does not support root job ${action} for saved ${entry.job.kind} jobs.`,
    {
      details: {
        platform: entry.job.platform,
        kind: entry.job.kind,
        jobId: entry.job.jobId,
        nextCommand: providerHint,
      },
    },
  );
}

function buildPlatformCommandPrefix(definition: Pick<PlatformDefinition, "id" | "category" | "commandCategories">): string {
  const category = definition.commandCategories?.[0] ?? definition.category;
  return `mikacli ${category} ${definition.id}`;
}

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  return typeof metadata?.[key] === "string" ? (metadata[key] as string) : undefined;
}

function readNumberMetadata(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  return typeof metadata?.[key] === "number" ? (metadata[key] as number) : undefined;
}

async function defaultSleep(ms: number): Promise<void> {
  await delay(ms);
}
