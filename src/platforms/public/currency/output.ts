import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printCurrencyResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const amount = typeof result.data?.amount === "number" ? result.data.amount : undefined;
  const from = asString(result.data?.from);
  if (typeof amount === "number" && from) {
    console.log(`Amount: ${formatNumber(amount)} ${from}`);
  }

  const conversions = Array.isArray(result.data?.conversions) ? result.data.conversions : [];
  if (conversions.length === 0) {
    return;
  }

  console.log("Conversions:");
  for (const entry of conversions) {
    const conversion = toRecord(entry);
    if (!conversion) {
      continue;
    }

    const code = asString(conversion.code);
    const rate = asNumber(conversion.rate);
    const value = asNumber(conversion.value);
    if (!code || rate === undefined || value === undefined) {
      continue;
    }

    console.log(`${code}: ${formatNumber(value)} (${code} rate ${formatNumber(rate)})`);
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(value);
}
