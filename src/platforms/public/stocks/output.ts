import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printStocksResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const quote = toRecord(result.data?.quote);
  if (!quote) {
    return;
  }

  const parts = [
    typeof quote.symbol === "string" ? quote.symbol.toUpperCase() : undefined,
    typeof quote.close === "number" ? `$${quote.close.toFixed(2)}` : undefined,
    typeof quote.date === "string" ? quote.date : undefined,
    typeof quote.time === "string" ? quote.time : undefined,
  ].filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    console.log(parts.join(" • "));
  }

  const range = [
    typeof quote.open === "number" ? `open ${quote.open.toFixed(2)}` : undefined,
    typeof quote.high === "number" ? `high ${quote.high.toFixed(2)}` : undefined,
    typeof quote.low === "number" ? `low ${quote.low.toFixed(2)}` : undefined,
    typeof quote.volume === "number" ? `volume ${Math.round(quote.volume)}` : undefined,
  ].filter((value): value is string => Boolean(value));

  if (range.length > 0) {
    console.log(range.join(" • "));
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}
