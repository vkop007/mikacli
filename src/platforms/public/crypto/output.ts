import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printCryptoResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = toRecord(result.data);
  if (!data) {
    return;
  }

  if (typeof data.name === "string" && typeof data.symbol === "string") {
    console.log(`${data.name} (${data.symbol.toUpperCase()})`);
  }

  if (typeof data.price === "number") {
    const currency = typeof data.vsCurrency === "string" ? data.vsCurrency.toUpperCase() : "USD";
    console.log(`Price: ${data.price.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${currency}`);
  }

  if (typeof data.change24h === "number") {
    console.log(`24h change: ${data.change24h.toFixed(2)}%`);
  }

  if (typeof data.marketCap === "number") {
    console.log(`Market cap: ${data.marketCap.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}
