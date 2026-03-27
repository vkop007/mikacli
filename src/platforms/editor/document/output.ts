import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printDocumentEditorResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const sizeBytes = asNumber(data.sizeBytes);
  const format = asString(data.format);
  const characters = asNumber(data.characters);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof sizeBytes === "number") {
    console.log(`bytes: ${sizeBytes}`);
  }

  if (typeof characters === "number") {
    console.log(`characters: ${characters}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
