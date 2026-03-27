import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printSubtitleEditorResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const videoPath = asString(data.videoPath);
  const subtitlePath = asString(data.subtitlePath);
  const format = asString(data.format);
  const cueCount = asNumber(data.cueCount);
  const shiftMs = asNumber(data.shiftMs);
  const syncMs = asNumber(data.syncMs);
  const removedCueCount = asNumber(data.removedCueCount);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (videoPath) {
    console.log(`video: ${videoPath}`);
  }

  if (subtitlePath) {
    console.log(`subtitle: ${subtitlePath}`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof cueCount === "number") {
    console.log(`cues: ${cueCount}`);
  }

  if (typeof shiftMs === "number") {
    console.log(`shift: ${shiftMs}ms`);
  }

  if (typeof syncMs === "number") {
    console.log(`sync: ${syncMs}ms`);
  }

  if (typeof removedCueCount === "number") {
    console.log(`removed: ${removedCueCount}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
