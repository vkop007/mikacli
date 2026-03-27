import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printScreenshotResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const width = typeof data.width === "number" ? data.width : undefined;
  const height = typeof data.height === "number" ? data.height : undefined;
  const sizeBytes = typeof data.sizeBytes === "number" ? data.sizeBytes : undefined;
  const contentType = asString(data.contentType);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (typeof width === "number" && typeof height === "number") {
    console.log(`size: ${width}x${height}`);
  }

  if (typeof sizeBytes === "number") {
    console.log(`bytes: ${sizeBytes}`);
  }

  if (contentType) {
    console.log(`content-type: ${contentType}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
