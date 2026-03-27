import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printTranslateResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const translatedText = typeof result.data?.translatedText === "string" ? result.data.translatedText : undefined;
  if (translatedText) {
    console.log(translatedText);
  }

  const sourceLanguage = asString(result.data?.sourceLanguage);
  const targetLanguage = asString(result.data?.targetLanguage);
  if (sourceLanguage || targetLanguage) {
    console.log(`Languages: ${sourceLanguage ?? "unknown"} -> ${targetLanguage ?? "unknown"}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
