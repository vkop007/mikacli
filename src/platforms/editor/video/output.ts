import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printVideoEditorResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const outputDir = asString(data.outputDir);
  const outputPattern = asString(data.outputPattern);
  const width = asNumber(data.width);
  const height = asNumber(data.height);
  const durationSeconds = asNumber(data.durationSeconds);
  const format = asString(data.format);
  const fps = asNumber(data.fps);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (outputDir) {
    console.log(`output-dir: ${outputDir}`);
  }

  if (outputPattern && outputPattern !== outputPath) {
    console.log(`pattern: ${outputPattern}`);
  }

  if (typeof width === "number" && typeof height === "number") {
    console.log(`size: ${width}x${height}`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof durationSeconds === "number") {
    console.log(`duration: ${durationSeconds.toFixed(2)}s`);
  }

  if (typeof fps === "number") {
    console.log(`fps: ${fps.toFixed(2)}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
