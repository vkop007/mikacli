import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printQrResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const ascii = typeof result.data?.ascii === "string" ? result.data.ascii.trimEnd() : "";
  if (ascii.length > 0) {
    console.log("");
    console.log(ascii);
  }

  if (typeof result.data?.imageUrl === "string" && result.data.imageUrl.trim().length > 0) {
    console.log(`image: ${result.data.imageUrl.trim()}`);
  }
}

