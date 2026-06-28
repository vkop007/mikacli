import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printJwtResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = toRecord(result.data);
  if (!data) {
    return;
  }

  console.log("\nHeader:");
  console.log(JSON.stringify(data.header, null, 2));

  console.log("\nPayload:");
  console.log(JSON.stringify(data.payload, null, 2));

  const timing = toRecord(data.timing);
  if (timing) {
    console.log("\nTiming:");
    if (timing.issuedAt) console.log(`- Issued At: ${timing.issuedAt}`);
    if (timing.expiresAt) console.log(`- Expires At: ${timing.expiresAt}`);
    console.log(`- Expired: ${timing.expired}`);
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}
