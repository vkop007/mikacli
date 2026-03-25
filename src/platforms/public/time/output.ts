import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printTimeResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const localDatetime = asString(result.data?.localDatetime);
  const timezone = asString(result.data?.timezone);
  const utcOffset = asString(result.data?.utcOffset);
  const dayOfWeekName = asString(result.data?.dayOfWeekName);
  const dayOfWeek = typeof result.data?.dayOfWeek === "number" ? result.data.dayOfWeek : undefined;

  if (localDatetime) {
    console.log(localDatetime);
  }

  const meta = [
    timezone,
    utcOffset ? `UTC${utcOffset}` : undefined,
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (dayOfWeekName) {
    console.log(`Day: ${dayOfWeekName}${typeof dayOfWeek === "number" ? ` (${dayOfWeek})` : ""}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
