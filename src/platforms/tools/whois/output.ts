import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printWhoisResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = toRecord(result.data);
  if (!data) {
    return;
  }

  if (typeof data.objectClassName === "string") {
    console.log(`Class: ${data.objectClassName}`);
  }

  if (typeof data.ldhName === "string") {
    console.log(`Name: ${data.ldhName}`);
  }

  if (typeof data.handle === "string") {
    console.log(`Handle: ${data.handle}`);
  }

  if (typeof data.registrar === "string") {
    console.log(`Registrar: ${data.registrar}`);
  }

  const nameservers = Array.isArray(data.nameservers) ? data.nameservers.filter((value): value is string => typeof value === "string") : [];
  if (nameservers.length > 0) {
    console.log(`Nameservers: ${nameservers.join(", ")}`);
  }

  const status = Array.isArray(data.status) ? data.status.filter((value): value is string => typeof value === "string") : [];
  if (status.length > 0) {
    console.log(`Status: ${status.join(", ")}`);
  }

  const events = Array.isArray(data.events) ? data.events : [];
  if (events.length > 0) {
    console.log("\nEvents:");
    for (const entry of events) {
      const event = toRecord(entry);
      if (!event) {
        continue;
      }

      const action = typeof event.action === "string" ? event.action : "event";
      const date = typeof event.date === "string" ? ` ${event.date}` : "";
      console.log(`- ${action}${date}`);
    }
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}
