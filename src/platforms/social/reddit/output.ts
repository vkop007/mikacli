import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printRedditStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data ?? {};
  if (typeof data.status === "string") {
    console.log(`status: ${data.status}`);
  }
  if (typeof data.details === "string" && data.details.length > 0) {
    console.log(`details: ${data.details}`);
  }
}
