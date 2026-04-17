import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  appendActionLog,
  buildActionLogCommandLabel,
  clearActionLogs,
  getActionLog,
  inferSafeCommandPath,
  listActionLogs,
  summarizeCommandPath,
} from "../action-log.js";

describe("action log store", () => {
  test("appends, filters, and loads action log entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autocli-action-log-"));
    const logPath = join(dir, "actions.jsonl");

    try {
      await appendActionLog(
        {
          startedAt: "2026-04-13T10:00:00.000Z",
          finishedAt: "2026-04-13T10:00:02.000Z",
          durationMs: 2_000,
          status: "success",
          command: "x/post",
          platform: "x",
          account: "default",
          action: "post",
          message: "Posted to X.",
        },
        logPath,
      );

      const failed = await appendActionLog(
        {
          startedAt: "2026-04-13T11:00:00.000Z",
          finishedAt: "2026-04-13T11:00:01.000Z",
          durationMs: 1_000,
          status: "failed",
          command: "youtube/upload",
          platform: "youtube",
          account: "default",
          action: "upload",
          message: "Upload failed.",
          errorCode: "HTTP_REQUEST_FAILED",
        },
        logPath,
      );

      const all = await listActionLogs({}, logPath);
      expect(all.map((entry) => entry.command)).toEqual(["youtube/upload", "x/post"]);

      const failedOnly = await listActionLogs({ status: "failed" }, logPath);
      expect(failedOnly).toHaveLength(1);
      expect(failedOnly[0]?.id).toBe(failed.id);

      const providerOnly = await listActionLogs({ provider: "x" }, logPath);
      expect(providerOnly).toHaveLength(1);
      expect(providerOnly[0]?.platform).toBe("x");

      const lookup = await getActionLog(failed.id, logPath);
      expect(lookup?.errorCode).toBe("HTTP_REQUEST_FAILED");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("clears the action log file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autocli-action-log-clear-"));
    const logPath = join(dir, "actions.jsonl");

    try {
      await appendActionLog(
        {
          startedAt: "2026-04-13T10:00:00.000Z",
          finishedAt: "2026-04-13T10:00:00.500Z",
          durationMs: 500,
          status: "success",
          command: "translate",
          message: "Translated text.",
        },
        logPath,
      );

      await clearActionLogs(logPath);
      expect(await listActionLogs({}, logPath)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("builds safe command labels without raw user arguments", () => {
    expect(buildActionLogCommandLabel({ platform: "x", action: "post" })).toBe("x/post");
    expect(buildActionLogCommandLabel({ platform: "translate", action: "translate" })).toBe("translate");
    expect(buildActionLogCommandLabel({ commandPath: "autocli logs show" })).toBe("logs/show");
    expect(buildActionLogCommandLabel({ commandPath: "autocli jobs download" })).toBe("jobs/download");
    expect(summarizeCommandPath("autocli social youtube upload")).toBe("youtube/upload");
    expect(inferSafeCommandPath(["social", "x", "post", "very secret text", "--json"])).toBe("autocli social x post");
    expect(inferSafeCommandPath(["search", "very secret text", "--json"])).toBe("autocli search");
    expect(inferSafeCommandPath(["jobs", "download", "job-secret-id"])).toBe("autocli jobs download");
  });
});
