import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printArchiveEditorResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const outputDir = asString(data.outputDir);
  const format = asString(data.format);
  const entryCount = asNumber(data.entryCount);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (outputDir) {
    console.log(`output-dir: ${outputDir}`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof entryCount === "number") {
    console.log(`entries: ${entryCount}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
