import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printTimezoneResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  if (typeof data.placeName === "string" && data.placeName.length > 0) {
    console.log(data.placeName);
  }

  const meta = [
    typeof data.timezone === "string" ? data.timezone : undefined,
    typeof data.abbreviation === "string" ? data.abbreviation : undefined,
    typeof data.utcOffset === "string" ? `UTC${data.utcOffset}` : undefined,
    typeof data.country === "string" ? data.country : undefined,
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.localDatetime === "string") {
    console.log(`localDatetime: ${data.localDatetime}`);
  }
  if (typeof data.latitude === "number" && typeof data.longitude === "number") {
    console.log(`coordinates: ${data.latitude}, ${data.longitude}`);
  }
}
