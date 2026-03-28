import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printOEmbedResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  for (const key of ["title", "providerName", "type", "authorName", "providerUrl", "thumbnailUrl", "finalUrl", "endpointUrl"]) {
    const value = data[key];
    if (typeof value === "string" && value.length > 0) {
      console.log(`${key}: ${value}`);
    }
  }

  if (typeof data.width === "number" || typeof data.height === "number") {
    console.log(`size: ${String(data.width ?? "?")}x${String(data.height ?? "?")}`);
  }

  if (typeof data.sourceMode === "string") {
    console.log(`source: ${data.sourceMode}`);
  }

  if (typeof data.html === "string" && data.html.trim().length > 0) {
    const preview = data.html.trim();
    console.log("html:");
    console.log(preview.length > 240 ? `${preview.slice(0, 240)}...` : preview);
  }
}
