import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { subtitleEditorAdapter } from "../adapter.js";

describe("subtitle editor adapter", () => {
  test("converts and shifts subtitle files", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "mikacli-subtitle-"));
    const inputPath = join(workDir, "input.srt");
    const shiftedPath = join(workDir, "input.shifted.srt");
    const convertedPath = join(workDir, "input.converted.vtt");

    const sample = `1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:05,000\nWorld\n`;
    await Bun.write(inputPath, sample);

    const info = await subtitleEditorAdapter.info({ inputPath });
    expect(info.ok).toBe(true);
    expect(info.data?.cueCount).toBe(2);

    const shifted = await subtitleEditorAdapter.shift({
      inputPath,
      by: 1,
      output: shiftedPath,
    });
    expect(shifted.ok).toBe(true);
    expect(readFileSync(shiftedPath, "utf8")).toContain("00:00:01,000 --> 00:00:03,000");

    const converted = await subtitleEditorAdapter.convert({
      inputPath,
      to: "vtt",
      output: convertedPath,
    });
    expect(converted.ok).toBe(true);
    expect(readFileSync(convertedPath, "utf8")).toContain("WEBVTT");

    rmSync(workDir, { recursive: true, force: true });
  });
});
