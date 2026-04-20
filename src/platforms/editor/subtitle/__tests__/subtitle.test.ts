import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mergeSubtitleDocuments, shiftSubtitleDocument, subtitleEditorAdapter } from "../adapter.js";

describe("subtitle editor", () => {
  test("loads srt info", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mikacli-subtitle-test-"));
    const file = join(dir, "sample.srt");
    writeFileSync(
      file,
      "1\n00:00:01,000 --> 00:00:02,500\nHello world\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond line\n",
      "utf8",
    );

    const result = await subtitleEditorAdapter.info({ inputPath: file });
    expect(result.ok).toBe(true);
    const data = result.data ?? {};
    expect(data.format).toBe("srt");
    expect(data.cueCount).toBe(2);
    expect(data.durationSeconds).toBe(4);

    rmSync(dir, { recursive: true, force: true });
  });

  test("shifts subtitle timings", async () => {
    const document = {
      format: "srt" as const,
      sourcePath: "/tmp/sample.srt",
      rawSizeBytes: 0,
      header: [],
      cues: [
        { startMs: 1000, endMs: 2000, text: ["Hello"] },
      ],
    };

    const shifted = shiftSubtitleDocument(document, 500);
    expect(shifted.cues[0]?.startMs).toBe(1500);
    expect(shifted.cues[0]?.endMs).toBe(2500);
  });

  test("merges multiple subtitle documents", () => {
    const merged = mergeSubtitleDocuments([
      {
        format: "srt",
        sourcePath: "/tmp/a.srt",
        rawSizeBytes: 10,
        header: [],
        cues: [{ startMs: 1000, endMs: 2000, text: ["A"] }],
      },
      {
        format: "srt",
        sourcePath: "/tmp/b.srt",
        rawSizeBytes: 10,
        header: [],
        cues: [{ startMs: 500, endMs: 900, text: ["B"] }],
      },
    ]);

    expect(merged.cues.map((cue: { text: string[] }) => cue.text[0])).toEqual(["B", "A"]);
  });

  test("converts subtitles between formats", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mikacli-subtitle-convert-"));
    const input = join(dir, "sample.srt");
    const output = join(dir, "sample.vtt");
    writeFileSync(input, "1\n00:00:01,000 --> 00:00:02,000\nHello\n", "utf8");

    const result = await subtitleEditorAdapter.convert({
      inputPath: input,
      to: "vtt",
      output,
    });

    expect(result.ok).toBe(true);
    expect(readFileSync(output, "utf8")).toContain("WEBVTT");
    const outputText = readFileSync(output, "utf8");
    expect(outputText).toContain("WEBVTT");
    expect(outputText).toMatch(/00:(?:00:)?01\.000 --> 00:(?:00:)?02\.000/);

    rmSync(dir, { recursive: true, force: true });
  });
});
