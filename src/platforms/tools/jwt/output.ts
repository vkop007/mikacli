import pc from "picocolors";
import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printJwtResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = toRecord(result.data);
  if (!data) {
    return;
  }

  if (result.action === "decode") {
    printHeaderAndPayload(data);
    printTiming(data.timing);
  } else if (result.action === "verify") {
    const isValid = !!data.isValid;
    console.log();
    if (isValid) {
      console.log(pc.green(pc.bold("✓ Signature is VALID")));
    } else {
      console.log(pc.red(pc.bold("✗ Signature is INVALID")));
    }
    printHeaderAndPayload(data);
    printTiming(data.timing);
  } else if (result.action === "sign") {
    console.log();
    console.log(pc.bold("Generated Token:"));
    console.log(pc.cyan(String(data.token || "")));
    printHeaderAndPayload(data);
  } else if (result.action === "audit") {
    const issues = (data.issues || []) as Array<{ severity: "HIGH" | "MEDIUM" | "LOW"; message: string; detail?: string }>;
    console.log();
    if (issues.length === 0) {
      console.log(pc.green(pc.bold("✓ No security issues detected.")));
    } else {
      console.log(pc.bold(`Found ${issues.length} potential security issues:\n`));
      for (const issue of issues) {
        let prefix = "";
        if (issue.severity === "HIGH") {
          prefix = pc.red(pc.bold("[HIGH]"));
        } else if (issue.severity === "MEDIUM") {
          prefix = pc.yellow(pc.bold("[MEDIUM]"));
        } else {
          prefix = pc.blue(pc.bold("[LOW]"));
        }
        console.log(`${prefix} ${pc.bold(issue.message)}`);
        if (issue.detail) {
          console.log(`       ${pc.dim(issue.detail)}`);
        }
        console.log();
      }
    }
  }
}

function printHeaderAndPayload(data: Record<string, unknown>): void {
  console.log("\nHeader:");
  console.log(pc.cyan(JSON.stringify(data.header, null, 2)));

  console.log("\nPayload:");
  console.log(pc.green(JSON.stringify(data.payload, null, 2)));
}

function printTiming(timingVal: unknown): void {
  const timing = toRecord(timingVal);
  if (timing) {
    console.log("\nTiming:");
    if (timing.issuedAt) console.log(`- Issued At: ${timing.issuedAt}`);
    if (timing.expiresAt) console.log(`- Expires At: ${timing.expiresAt}`);
    const expiredText = timing.expired ? pc.red("true") : pc.green("false");
    console.log(`- Expired: ${expiredText}`);
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}
