import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printGeoResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = (result.data ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "object") {
      console.log(`${key}: ${JSON.stringify(value)}`);
      continue;
    }

    console.log(`${key}: ${String(value)}`);
  }
}
