import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildStoredMediaJobActionResult,
  createJobsCommand,
  findSavedMediaJob,
  listSavedMediaJobs,
  summarizeMediaJobs,
  waitForStoredMediaJob,
} from "../commands/jobs.js";
import { createMediaJobRecord, MediaJobStore } from "../core/media-jobs/store.js";
import { AutoCliError } from "../errors.js";

describe("jobs command", () => {
  test("registers the expected subcommands", () => {
    const command = createJobsCommand();
    expect(command.name()).toBe("jobs");
    expect(command.commands.map((subcommand) => subcommand.name())).toEqual([
      "list",
      "show",
      "watch",
      "download",
      "cancel",
    ]);
  });

  test("summarizes saved job statuses", () => {
    const summary = summarizeMediaJobs([
      {
        job: createMediaJobRecord({
          platform: "gemini",
          kind: "image",
          account: "default",
          status: "completed",
        }),
        path: "/tmp/job-1.json",
        displayName: "Gemini",
        availableActions: {
          watch: true,
          download: true,
          cancel: false,
        },
      },
      {
        job: createMediaJobRecord({
          platform: "grok",
          kind: "video",
          account: "default",
          status: "processing",
        }),
        path: "/tmp/job-2.json",
        displayName: "Grok",
        availableActions: {
          watch: true,
          download: true,
          cancel: true,
        },
      },
    ]);

    expect(summary).toEqual({
      total: 2,
      queued: 0,
      processing: 1,
      completed: 1,
      failed: 0,
      canceled: 0,
      unknown: 0,
    });
  });

  test("lists jobs and annotates available root actions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autocli-jobs-list-"));
    const store = new MediaJobStore(dir);

    try {
      await store.saveJob(
        createMediaJobRecord({
          platform: "gemini",
          kind: "image",
          account: "default",
          status: "completed",
          providerJobId: "cand_1",
          outputUrls: ["https://example.com/image.png"],
        }),
      );
      await store.saveJob(
        createMediaJobRecord({
          platform: "grok",
          kind: "video",
          account: "default",
          status: "processing",
          providerJobId: "video_1",
          conversationId: "conv_1",
        }),
      );

      const jobs = await listSavedMediaJobs({
        store,
        platforms: ["gemini", "grok"],
        limit: undefined,
      });

      const gemini = jobs.find((entry) => entry.job.platform === "gemini");
      const grok = jobs.find((entry) => entry.job.platform === "grok");

      expect(gemini?.availableActions).toEqual({
        watch: true,
        download: true,
        cancel: false,
      });
      expect(grok?.availableActions).toEqual({
        watch: true,
        download: true,
        cancel: true,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("finds saved jobs by job id and provider identifiers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autocli-jobs-find-"));
    const store = new MediaJobStore(dir);

    try {
      const job = createMediaJobRecord({
        platform: "grok",
        kind: "video",
        account: "default",
        status: "processing",
        providerJobId: "video_123",
        conversationId: "conv_123",
        responseId: "resp_123",
      });
      await store.saveJob(job);

      expect((await findSavedMediaJob({ target: job.jobId, store, platforms: ["grok"] })).job.jobId).toBe(job.jobId);
      expect((await findSavedMediaJob({ target: "video_123", store, platforms: ["grok"] })).job.jobId).toBe(job.jobId);
      expect((await findSavedMediaJob({ target: "conv_123", store, platforms: ["grok"] })).job.jobId).toBe(job.jobId);
      expect((await findSavedMediaJob({ target: "resp_123", store, platforms: ["grok"] })).job.jobId).toBe(job.jobId);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("throws on ambiguous saved job targets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autocli-jobs-ambiguous-"));
    const store = new MediaJobStore(dir);

    try {
      await store.saveJob(
        createMediaJobRecord({
          platform: "grok",
          kind: "video",
          account: "default",
          status: "processing",
          conversationId: "shared-target",
        }),
      );
      await store.saveJob(
        createMediaJobRecord({
          platform: "gemini",
          kind: "video",
          account: "default",
          status: "completed",
          conversationId: "shared-target",
        }),
      );

      await expect(findSavedMediaJob({ target: "shared-target", store, platforms: ["grok", "gemini"] })).rejects.toThrow(
        AutoCliError,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("waits until a stored job reaches a terminal state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autocli-jobs-watch-"));
    const store = new MediaJobStore(dir);

    try {
      const initial = createMediaJobRecord({
        platform: "grok",
        kind: "video",
        account: "default",
        status: "processing",
      });
      await store.saveJob(initial);

      let sleeps = 0;
      const result = await waitForStoredMediaJob({
        store,
        platform: "grok",
        jobId: initial.jobId,
        timeoutMs: 100,
        intervalMs: 1,
        sleep: async () => {
          sleeps += 1;
          if (sleeps === 1) {
            await store.saveJob(
              createMediaJobRecord({
                platform: "grok",
                kind: "video",
                account: "default",
                status: "completed",
                existingJob: initial,
              }),
            );
          }
        },
      });

      expect(result.job.status).toBe("completed");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("builds reusable action payloads from stored jobs", () => {
    const job = createMediaJobRecord({
      platform: "gemini",
      kind: "image",
      account: "default",
      status: "completed",
      providerJobId: "cand_123",
      conversationId: "chat_123",
      responseId: "resp_123",
      outputUrls: ["https://example.com/image.png"],
      outputPaths: ["/tmp/image.png"],
      metadata: {
        model: "gemini-3-flash",
        outputText: "Rendered.",
      },
    });

    const result = buildStoredMediaJobActionResult(
      {
        job,
        path: "/tmp/job.json",
        displayName: "Gemini",
        availableActions: {
          watch: true,
          download: true,
          cancel: false,
        },
      },
      "download",
      "Loaded saved Gemini image outputs.",
    );

    expect(result.data).toMatchObject({
      jobId: job.jobId,
      jobPath: "/tmp/job.json",
      status: "completed",
      model: "gemini-3-flash",
      conversationId: "chat_123",
      responseId: "resp_123",
      providerJobId: "cand_123",
      outputUrls: ["https://example.com/image.png"],
      outputPaths: ["/tmp/image.png"],
    });
  });
});
