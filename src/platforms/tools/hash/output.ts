import pc from "picocolors";
import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printHashResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = toRecord(result.data);
  if (!data) {
    return;
  }

  if (result.action === "digest" || result.action === "hmac") {
    console.log();
    console.log(pc.cyan(String(data.digest ?? "")));
    console.log(pc.dim(`${data.algorithm} · ${data.encoding} · ${data.bytes} bytes · ${data.source}`));
    return;
  }

  if (result.action === "verify") {
    console.log();
    if (data.matches) {
      console.log(pc.green(pc.bold("✓ Checksum MATCHES")));
    } else {
      console.log(pc.red(pc.bold("✗ Checksum MISMATCH")));
    }
    console.log(`- Algorithm: ${data.algorithm}`);
    console.log(`- Expected:  ${pc.dim(String(data.expected ?? ""))}`);
    console.log(`- Actual:    ${data.matches ? pc.green(String(data.actual ?? "")) : pc.red(String(data.actual ?? ""))}`);
    return;
  }

  if (result.action === "encode") {
    console.log();
    console.log(pc.cyan(String(data.output ?? "")));
    console.log(pc.dim(`${data.from} → ${data.to} · ${data.bytes} bytes`));
    return;
  }

  if (result.action === "uuid" || result.action === "random" || result.action === "algorithms") {
    const items = Array.isArray(data.items) ? data.items : [];
    console.log();
    for (const item of items) {
      console.log(pc.cyan(String(item)));
    }
    if (typeof data.guidance === "string") {
      console.log(pc.dim(`\n${data.guidance}`));
    }
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}
