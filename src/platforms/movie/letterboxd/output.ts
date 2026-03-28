import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printLetterboxdDiaryResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? (result.data.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log("No diary entries found.");
    return;
  }

  for (const item of items) {
    const title = String(item.title ?? "-");
    const year = item.year === undefined ? "" : ` (${String(item.year)})`;
    console.log(`${title}${year}`);
    if (item.watchedDate !== undefined) {
      console.log(`watchedDate: ${String(item.watchedDate)}`);
    }
    if (item.rating !== undefined) {
      console.log(`rating: ${String(item.rating)}`);
    }
    if (item.summary !== undefined && String(item.summary).trim().length > 0) {
      console.log(`summary: ${String(item.summary)}`);
    }
    if (item.url !== undefined) {
      console.log(`url: ${String(item.url)}`);
    }
    console.log("");
  }
}
