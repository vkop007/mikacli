import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
  JOBS_DIR,
  ensureParentDirectory,
  sanitizeAccountName,
} from "../../config.js";
import { MikaCliError } from "../../errors.js";
import { isPlatform } from "../../platforms/config.js";

import type { Platform } from "../../types.js";

export type MediaJobState = "queued" | "processing" | "completed" | "failed" | "canceled" | "unknown";

export interface MediaJobRecord {
  version: 1;
  jobId: string;
  platform: Platform;
  kind: string;
  account: string;
  createdAt: string;
  updatedAt: string;
  status: MediaJobState;
  message?: string;
  prompt?: string;
  providerJobId?: string;
  conversationId?: string;
  responseId?: string;
  outputUrl?: string;
  outputUrls?: string[];
  outputPaths?: string[];
  metadata?: Record<string, unknown>;
}

const MediaJobRecordSchema = {
  parse(input: unknown): MediaJobRecord {
    if (!input || typeof input !== "object") {
      throw new MikaCliError("INVALID_MEDIA_JOB_FILE", "Media job file is not a valid JSON object.");
    }

    const record = input as Partial<MediaJobRecord>;
    if (
      record.version !== 1 ||
      typeof record.jobId !== "string" ||
      typeof record.platform !== "string" ||
      !isPlatform(record.platform) ||
      typeof record.kind !== "string" ||
      typeof record.account !== "string" ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string" ||
      typeof record.status !== "string"
    ) {
      throw new MikaCliError("INVALID_MEDIA_JOB_FILE", "Media job file is missing required fields.");
    }

    return {
      ...record,
      outputUrls: Array.isArray(record.outputUrls)
        ? record.outputUrls.filter((value): value is string => typeof value === "string" && value.length > 0)
        : undefined,
      outputPaths: Array.isArray(record.outputPaths)
        ? record.outputPaths.filter((value): value is string => typeof value === "string" && value.length > 0)
        : undefined,
    } as MediaJobRecord;
  },
};

export function createMediaJobRecord(input: {
  platform: Platform;
  kind: string;
  account: string;
  status: MediaJobState;
  message?: string;
  prompt?: string;
  providerJobId?: string;
  conversationId?: string;
  responseId?: string;
  outputUrl?: string;
  outputUrls?: string[];
  outputPaths?: string[];
  metadata?: Record<string, unknown>;
  existingJob?: MediaJobRecord;
}): MediaJobRecord {
  const now = new Date().toISOString();
  const existing = input.existingJob;

  return {
    version: 1,
    jobId: existing?.jobId ?? randomUUID(),
    platform: input.platform,
    kind: input.kind.trim(),
    account: sanitizeAccountName(input.account),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: input.status,
    message: input.message ?? existing?.message,
    prompt: input.prompt ?? existing?.prompt,
    providerJobId: input.providerJobId ?? existing?.providerJobId,
    conversationId: input.conversationId ?? existing?.conversationId,
    responseId: input.responseId ?? existing?.responseId,
    outputUrl: input.outputUrl ?? existing?.outputUrl,
    outputUrls: dedupeStrings([...(existing?.outputUrls ?? []), ...(input.outputUrls ?? [])]),
    outputPaths: dedupeStrings([...(existing?.outputPaths ?? []), ...(input.outputPaths ?? [])]),
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
  };
}

export class MediaJobStore {
  constructor(private readonly jobsRoot = JOBS_DIR) {}

  async saveJob(job: MediaJobRecord): Promise<string> {
    const jobPath = this.getJobPath(job.platform, job.jobId);
    await ensureParentDirectory(jobPath);
    await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
    return jobPath;
  }

  async loadJob(platform: Platform, jobId: string): Promise<{ job: MediaJobRecord; path: string }> {
    const path = this.getJobPath(platform, jobId);
    await access(path, constants.R_OK).catch(() => {
      throw new MikaCliError("MEDIA_JOB_NOT_FOUND", `No saved ${platform} job was found for ${jobId}.`, {
        details: {
          platform,
          jobId,
          path,
        },
      });
    });

    const raw = await readFile(path, "utf8");
    return {
      job: MediaJobRecordSchema.parse(JSON.parse(raw)),
      path,
    };
  }

  async findJob(
    platform: Platform,
    target: string,
    input: {
      kind?: string;
      account?: string;
    } = {},
  ): Promise<{ job: MediaJobRecord; path: string } | undefined> {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) {
      return undefined;
    }

    try {
      return await this.loadJob(platform, normalizedTarget);
    } catch (error) {
      if (!(error instanceof MikaCliError) || error.code !== "MEDIA_JOB_NOT_FOUND") {
        throw error;
      }
    }

    const jobs = await this.listJobs(platform, input);
    return jobs.find(({ job }) => matchesMediaJobTarget(job, normalizedTarget));
  }

  async listJobs(
    platform: Platform,
    input: {
      kind?: string;
      account?: string;
    } = {},
  ): Promise<Array<{ job: MediaJobRecord; path: string }>> {
    const directory = this.getPlatformJobDir(platform);
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (isMissingFileError(error)) {
        return [];
      }

      throw error;
    });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

    const jobs = await Promise.all(
      files.map(async (entry) => {
        const path = `${directory}/${entry.name}`;
        const raw = await readFile(path, "utf8");
        return {
          job: MediaJobRecordSchema.parse(JSON.parse(raw)),
          path,
        };
      }),
    );

    return jobs
      .filter(({ job }) => {
        if (input.kind && job.kind !== input.kind) {
          return false;
        }
        if (input.account && job.account !== sanitizeAccountName(input.account)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.job.updatedAt.localeCompare(left.job.updatedAt));
  }

  private getPlatformJobDir(platform: Platform): string {
    return join(this.jobsRoot, platform);
  }

  private getJobPath(platform: Platform, jobId: string): string {
    return join(this.getPlatformJobDir(platform), `${sanitizeAccountName(jobId)}.json`);
  }
}

export function matchesMediaJobTarget(job: MediaJobRecord, target: string): boolean {
  return (
    job.jobId === target ||
    job.providerJobId === target ||
    job.conversationId === target ||
    job.responseId === target
  );
}

function dedupeStrings(values: readonly string[]): string[] | undefined {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped.length > 0 ? deduped : undefined;
}

function isMissingFileError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
