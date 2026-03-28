import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printDnsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const answers = Array.isArray(result.data?.answers) ? result.data.answers : [];
  if (answers.length === 0) {
    return;
  }

  console.log("\nAnswers:");
  for (const answer of answers) {
    const record = toRecord(answer);
    if (!record) {
      continue;
    }

    const ttl = typeof record.ttl === "number" ? ` ttl ${record.ttl}` : "";
    console.log(`${asString(record.name) ?? "?"} ${asString(record.type) ?? "?"}${ttl} ${asString(record.data) ?? ""}`.trim());
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
