import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printImageEditorResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const width = asNumber(data.width);
  const height = asNumber(data.height);
  const format = asString(data.format);
  const sizeBytes = asNumber(data.sizeBytes);
  const factor = asNumber(data.factor);
  const sourceWidth = asNumber(data.sourceWidth);
  const sourceHeight = asNumber(data.sourceHeight);
  const model = asString(data.model);
  const aspect = asString(data.aspect);
  const colors = asNumber(data.colors);
  const gap = asNumber(data.gap);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (typeof width === "number" && typeof height === "number") {
    console.log(`size: ${width}x${height}`);
  }

  if (typeof sourceWidth === "number" && typeof sourceHeight === "number") {
    console.log(`source-size: ${sourceWidth}x${sourceHeight}`);
  }

  if (typeof factor === "number") {
    console.log(`factor: ${factor}`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof sizeBytes === "number") {
    console.log(`bytes: ${sizeBytes}`);
  }

  if (model) {
    console.log(`model: ${model}`);
  }

  if (aspect) {
    console.log(`aspect: ${aspect}`);
  }

  if (typeof colors === "number") {
    console.log(`colors: ${colors}`);
  }

  if (typeof gap === "number") {
    console.log(`gap: ${gap}px`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
