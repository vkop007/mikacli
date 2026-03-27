import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printAudioResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const format = asString(data.format);
  const durationSeconds = asNumber(data.durationSeconds);
  const sampleRate = asNumber(data.sampleRate);
  const channels = asNumber(data.channels);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof durationSeconds === "number") {
    console.log(`duration: ${durationSeconds.toFixed(2)}s`);
  }

  if (typeof sampleRate === "number") {
    console.log(`sample-rate: ${sampleRate} Hz`);
  }

  if (typeof channels === "number") {
    console.log(`channels: ${channels}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
