import { basename, dirname, extname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { ensureParentDirectory } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";
import { assertLocalInputFile, normalizeOutputExtension, runFfmpegEdit } from "../shared/ffmpeg.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type SubtitleFormat = "srt" | "vtt";

type SubtitleInfoInput = {
  inputPath: string;
};

type SubtitleConvertInput = {
  inputPath: string;
  to: SubtitleFormat;
  output?: string;
};

type SubtitleShiftInput = {
  inputPath: string;
  by: string | number;
  output?: string;
};

type SubtitleCleanInput = {
  inputPath: string;
  output?: string;
};

type SubtitleMergeInput = {
  inputPaths: string[];
  output?: string;
};

type SubtitleBurnInput = {
  inputPath: string;
  subtitlePath: string;
  output?: string;
};

interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string[];
}

export class SubtitleEditorAdapter {
  readonly platform: Platform = "subtitle" as Platform;
  readonly displayName = "Subtitle Editor";

  async info(input: SubtitleInfoInput): Promise<AdapterActionResult> {
    const document = await loadSubtitleDocument(input.inputPath);
    const lastCue = document.cues.at(-1);

    return this.buildResult({
      action: "info",
      message: `Loaded subtitle info for ${basename(input.inputPath)}.`,
      data: {
        inputPath: input.inputPath,
        format: document.format,
        cueCount: document.cues.length,
        firstCueStartMs: document.cues[0]?.startMs ?? null,
        lastCueEndMs: lastCue?.endMs ?? null,
        durationMs: lastCue?.endMs ?? null,
        durationSeconds: lastCue ? Math.round(lastCue.endMs / 1000) : null,
      },
    });
  }

  async convert(input: SubtitleConvertInput): Promise<AdapterActionResult> {
    const document = await loadSubtitleDocument(input.inputPath);
    const outputPath = resolveSubtitleOutputPath(input.inputPath, input.output, "converted", input.to);

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, serializeSubtitleDocument(document.cues, input.to), "utf8");

    return this.buildResult({
      action: "convert",
      message: `Converted subtitles to ${input.to.toUpperCase()} at ${outputPath}.`,
      data: {
        inputPath: input.inputPath,
        outputPath,
        format: input.to,
        cueCount: document.cues.length,
      },
    });
  }

  async shift(input: SubtitleShiftInput): Promise<AdapterActionResult> {
    const shiftMs = parseShiftToMs(input.by);
    const document = await loadSubtitleDocument(input.inputPath);
    const shiftedCues = shiftSubtitleCues(document.cues, shiftMs);
    const outputPath = resolveSubtitleOutputPath(input.inputPath, input.output, "shifted", document.format);

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, serializeSubtitleDocument(shiftedCues, document.format), "utf8");

    return this.buildResult({
      action: "shift",
      message: `Shifted subtitles by ${shiftMs}ms into ${outputPath}.`,
      data: {
        inputPath: input.inputPath,
        outputPath,
        format: document.format,
        shiftMs,
        cueCount: shiftedCues.length,
      },
    });
  }

  async sync(input: SubtitleShiftInput): Promise<AdapterActionResult> {
    const shiftMs = parseShiftToMs(input.by);
    const document = await loadSubtitleDocument(input.inputPath);
    const syncedCues = shiftSubtitleCues(document.cues, shiftMs);
    const outputPath = resolveSubtitleOutputPath(input.inputPath, input.output, "synced", document.format);

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, serializeSubtitleDocument(syncedCues, document.format), "utf8");

    return this.buildResult({
      action: "sync",
      message: `Synced subtitles by ${shiftMs}ms into ${outputPath}.`,
      data: {
        inputPath: input.inputPath,
        outputPath,
        format: document.format,
        syncMs: shiftMs,
        cueCount: syncedCues.length,
      },
    });
  }

  async clean(input: SubtitleCleanInput): Promise<AdapterActionResult> {
    const document = await loadSubtitleDocument(input.inputPath);
    const cleaned = cleanSubtitleDocument(document);
    const outputPath = resolveSubtitleOutputPath(input.inputPath, input.output, "cleaned", document.format);

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, serializeSubtitleDocument(cleaned.cues, cleaned.format), "utf8");

    return this.buildResult({
      action: "clean",
      message: `Cleaned subtitles into ${outputPath}.`,
      data: {
        inputPath: input.inputPath,
        outputPath,
        format: cleaned.format,
        cueCount: cleaned.cues.length,
        removedCueCount: document.cues.length - cleaned.cues.length,
        cleanedCueCount: cleaned.cues.length,
      },
    });
  }

  async merge(input: SubtitleMergeInput): Promise<AdapterActionResult> {
    if (input.inputPaths.length < 2) {
      throw new AutoCliError("SUBTITLE_MERGE_REQUIRES_MULTIPLE_INPUTS", "Merge needs at least two subtitle files.");
    }

    const documents = await Promise.all(input.inputPaths.map((inputPath) => loadSubtitleDocument(inputPath)));
    const format = documents[0]?.format ?? "srt";

    for (const document of documents) {
      if (document.format !== format) {
        throw new AutoCliError("SUBTITLE_FORMAT_MISMATCH", "All subtitle files must use the same format to merge.", {
          details: {
            formats: documents.map((entry) => entry.format),
          },
        });
      }
    }

    const mergedCues = documents.flatMap((document) => document.cues).sort((left, right) => left.startMs - right.startMs);
    const firstInputPath = input.inputPaths[0];
    if (!firstInputPath) {
      throw new AutoCliError("SUBTITLE_MERGE_REQUIRES_MULTIPLE_INPUTS", "Merge needs at least two subtitle files.");
    }

    const outputPath = resolveSubtitleOutputPath(firstInputPath, input.output, "merged", format);
    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, serializeSubtitleDocument(mergedCues, format), "utf8");

    return this.buildResult({
      action: "merge",
      message: `Merged ${documents.length} subtitle files into ${outputPath}.`,
      data: {
        inputPaths: input.inputPaths,
        outputPath,
        format,
        cueCount: mergedCues.length,
      },
    });
  }

  async burn(input: SubtitleBurnInput): Promise<AdapterActionResult> {
    const subtitlePath = await assertLocalInputFile(input.subtitlePath);
    const outputPath = resolveSubtitleBurnOutputPath(input.inputPath, input.output);
    await ensureParentDirectory(outputPath);

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vf",
        `subtitles='${escapeSubtitleFilterPath(subtitlePath)}'`,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        ...buildBurnVideoCodecArgs(normalizeBurnVideoFormat(outputPath)),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "burn",
      message: `Burned subtitles from ${basename(subtitlePath)} into ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        subtitlePath,
        outputPath: resolvedOutput,
        format: normalizeOutputExtension(extname(resolvedOutput).replace(/^\./, "") || "mp4"),
      },
    });
  }

  private buildResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const subtitleEditorAdapter = new SubtitleEditorAdapter();

export interface SubtitleDocument {
  format: SubtitleFormat;
  sourcePath: string;
  rawSizeBytes: number;
  header: string[];
  cues: SubtitleCue[];
}

export function shiftSubtitleDocument(document: SubtitleDocument, shiftMs: number): SubtitleDocument {
  return {
    ...document,
    cues: shiftSubtitleCues(document.cues, shiftMs),
  };
}

export function syncSubtitleDocument(document: SubtitleDocument, shiftMs: number): SubtitleDocument {
  return shiftSubtitleDocument(document, shiftMs);
}

export function cleanSubtitleDocument(document: SubtitleDocument): SubtitleDocument {
  const cleanedCues: SubtitleCue[] = [];
  const seen = new Set<string>();

  const normalizedCues = document.cues
    .map((cue) => ({
      startMs: Math.max(0, Math.round(cue.startMs)),
      endMs: Math.max(0, Math.round(cue.endMs)),
      text: cue.text.map((line) => line.trimEnd()).filter((line, index, lines) => line.length > 0 || lines.length === 1 || index > 0 || lines.slice(0, index).some((item) => item.length > 0)),
    }))
    .map((cue) => ({
      ...cue,
      text: trimSubtitleTextLines(cue.text),
    }))
    .filter((cue) => cue.text.length > 0)
    .map((cue) => ({
      ...cue,
      endMs: Math.max(cue.startMs + 1, cue.endMs),
    }))
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.text.join("\n").localeCompare(right.text.join("\n")));

  for (const cue of normalizedCues) {
    const signature = `${cue.startMs}:${cue.endMs}:${cue.text.join("\n")}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    cleanedCues.push(cue);
  }

  return {
    ...document,
    cues: cleanedCues,
  };
}

export function mergeSubtitleDocuments(documents: SubtitleDocument[]): SubtitleDocument {
  if (documents.length === 0) {
    throw new AutoCliError("SUBTITLE_MERGE_REQUIRES_MULTIPLE_INPUTS", "Merge needs at least two subtitle files.");
  }

  const format = documents[0]?.format ?? "srt";
  const mergedCues = documents.flatMap((document) => document.cues);
  mergedCues.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);

  return {
    format,
    sourcePath: documents[0]!.sourcePath,
    rawSizeBytes: documents.reduce((sum, document) => sum + document.rawSizeBytes, 0),
    header: documents.flatMap((document) => document.header),
    cues: mergedCues,
  };
}

function resolveSubtitleOutputPath(
  inputPath: string,
  output: string | undefined,
  suffix: string,
  format: SubtitleFormat,
): string {
  if (output) {
    return resolve(output);
  }

  const absolutePath = resolve(inputPath);
  const directory = dirname(absolutePath);
  const stem = basename(absolutePath, extname(absolutePath)) || "subtitles";
  return `${directory}/${stem}.${suffix}.${format}`;
}

function resolveSubtitleBurnOutputPath(inputPath: string, output: string | undefined): string {
  if (output) {
    return resolve(output);
  }

  const absolutePath = resolve(inputPath);
  const directory = dirname(absolutePath);
  const stem = basename(absolutePath, extname(absolutePath)) || "video";
  return `${directory}/${stem}.subtitled.mp4`;
}

function shiftSubtitleCues(cues: SubtitleCue[], shiftMs: number): SubtitleCue[] {
  return cues.map((cue) => ({
    ...cue,
    startMs: Math.max(0, cue.startMs + shiftMs),
    endMs: Math.max(0, cue.endMs + shiftMs),
  }));
}

export async function loadSubtitleDocument(inputPath: string): Promise<SubtitleDocument> {
  const resolved = resolve(inputPath);
  let content: string;
  try {
    content = await readFile(resolved, "utf8");
  } catch (error) {
    throw new AutoCliError("SUBTITLE_INPUT_NOT_FOUND", `Subtitle file does not exist: ${inputPath}`, {
      details: {
        inputPath,
        resolvedPath: resolved,
      },
      cause: error as Error,
    });
  }

  const format = detectSubtitleFormat(resolved, content);
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const header = format === "vtt" && normalizedContent.trimStart().startsWith("WEBVTT") ? ["WEBVTT"] : [];
  return {
    format,
    sourcePath: resolved,
    rawSizeBytes: Buffer.byteLength(content, "utf8"),
    header,
    cues: format === "srt" ? parseSrt(content) : parseVtt(content),
  };
}

function detectSubtitleFormat(inputPath: string, content: string): SubtitleFormat {
  const extension = extname(inputPath).replace(/^\./, "").toLowerCase();
  if (extension === "vtt") {
    return "vtt";
  }
  if (extension === "srt") {
    return "srt";
  }
  return content.trimStart().startsWith("WEBVTT") ? "vtt" : "srt";
}

function parseSrt(content: string): SubtitleCue[] {
  const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timingLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingLineIndex < 0) {
      continue;
    }

    const timingLine = lines[timingLineIndex];
    if (!timingLine) {
      continue;
    }

    const [startRaw, endRaw] = timingLine.split("-->").map((part) => part.trim()) as [string, string];
    const text = lines.slice(timingLineIndex + 1).filter(Boolean);
    cues.push({
      startMs: parseSubtitleTimestampToMs(startRaw),
      endMs: parseSubtitleTimestampToMs(endRaw),
      text,
    });
  }

  return cues;
}

function parseVtt(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const body = normalized.startsWith("WEBVTT") ? normalized.slice("WEBVTT".length).trimStart() : normalized;
  const blocks = body.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timingLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingLineIndex < 0) {
      continue;
    }

    const timingLine = lines[timingLineIndex];
    if (!timingLine) {
      continue;
    }

    const [startRaw, endRaw] = timingLine.split("-->").map((part) => part.trim().split(" ")[0]) as [string, string];
    const text = lines.slice(timingLineIndex + 1).filter(Boolean);
    cues.push({
      startMs: parseSubtitleTimestampToMs(startRaw),
      endMs: parseSubtitleTimestampToMs(endRaw),
      text,
    });
  }

  return cues;
}

function serializeSubtitleDocument(cues: SubtitleCue[], format: SubtitleFormat): string {
  if (format === "vtt") {
    return ["WEBVTT", "", ...cues.map((cue) => `${formatMsToTimestamp(cue.startMs)} --> ${formatMsToTimestamp(cue.endMs)}\n${cue.text.join("\n")}`)].join("\n\n") + "\n";
  }

  return (
    cues
      .map((cue, index) => {
        return [
          String(index + 1),
          `${formatMsToTimestamp(cue.startMs, true)} --> ${formatMsToTimestamp(cue.endMs, true)}`,
          ...cue.text,
        ].join("\n");
      })
      .join("\n\n") + "\n"
  );
}

function parseShiftToMs(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new AutoCliError("SUBTITLE_SHIFT_INVALID", "Subtitle shift must be a finite number.");
    }

    return Math.round(value * 1000);
  }

  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed) * 1000);
  }

  const sign = trimmed.startsWith("-") ? -1 : 1;
  const cleaned = trimmed.replace(/^[+-]/, "");
  const parts = cleaned.split(":");
  if (parts.length === 3) {
    const [hoursRaw, minutesRaw, secondsRaw] = parts as [string, string, string];
    return sign * (Number(hoursRaw) * 3_600_000 + Number(minutesRaw) * 60_000 + parseSecondsPart(secondsRaw));
  }

  const [minutesRaw, secondsRaw = "0"] = parts;
  return sign * (Number(minutesRaw) * 60_000 + parseSecondsPart(secondsRaw));
}

function parseSubtitleTimestampToMs(value: string): number {
  const cleaned = value.trim().replace(",", ".");
  const [hoursRaw, minutesRaw, secondsRaw] = cleaned.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw ?? "0");

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    throw new AutoCliError("SUBTITLE_TIMESTAMP_INVALID", `Invalid subtitle timestamp "${value}".`);
  }

  return Math.round(hours * 3_600_000 + minutes * 60_000 + seconds * 1000);
}

function parseSecondsPart(value: string): number {
  const seconds = Number(value.replace(",", "."));
  if (!Number.isFinite(seconds)) {
    throw new AutoCliError("SUBTITLE_TIMESTAMP_INVALID", `Invalid subtitle timestamp "${value}".`);
  }

  return Math.round(seconds * 1000);
}

function trimSubtitleTextLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim().length === 0) {
    start += 1;
  }

  while (end > start && lines[end - 1]?.trim().length === 0) {
    end -= 1;
  }

  return lines.slice(start, end).map((line) => line.trimEnd());
}

function buildBurnVideoCodecArgs(format: string): string[] {
  if (normalizeOutputExtension(format) === "webm") {
    return [
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "32",
      "-b:v",
      "0",
      "-row-mt",
      "1",
      "-c:a",
      "libopus",
      "-b:a",
      "128k",
    ];
  }

  return [
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    ...(normalizeOutputExtension(format) === "mp4" ? ["-movflags", "+faststart"] : []),
  ];
}

function normalizeBurnVideoFormat(outputPath: string): string {
  const extension = normalizeOutputExtension(extname(outputPath).replace(/^\./, ""));
  return extension || "mp4";
}

function escapeSubtitleFilterPath(value: string): string {
  return resolve(value).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function formatMsToTimestamp(ms: number, srt = false): string {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = String(totalMs % 1000).padStart(3, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${srt ? `,${millis}` : `.${millis}`}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
