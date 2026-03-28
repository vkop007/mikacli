import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printCheatResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const snippet = typeof result.data?.snippet === "string" ? result.data.snippet.trim() : "";
  if (snippet.length > 0) {
    console.log("");
    console.log(snippet);
  }
}

