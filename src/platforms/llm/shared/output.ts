import { printActionResult } from "../../../utils/cli.js";
import { printMediaJobActionResult } from "../../../utils/media-job-output.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printCookieLlmStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const status = typeof result.data?.status === "string" ? result.data.status : undefined;
  const validated = typeof result.data?.lastValidatedAt === "string" ? result.data.lastValidatedAt : undefined;

  if (status) {
    console.log(`status: ${status}`);
  }
  if (validated) {
    console.log(`validated: ${validated}`);
  }
}

export function printCookieLlmTextResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const outputText = typeof result.data?.outputText === "string" ? result.data.outputText : undefined;
  if (outputText) {
    console.log("");
    console.log(outputText);
  }
}

export function printCookieLlmMediaResult(result: AdapterActionResult, json: boolean): void {
  printMediaJobActionResult(result, json);
}

export function printCookieLlmMediaJobResult(result: AdapterActionResult, json: boolean): void {
  printMediaJobActionResult(result, json);
}
