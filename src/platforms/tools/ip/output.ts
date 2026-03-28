import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printIpResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const ip = typeof result.data?.ip === "string" ? result.data.ip : undefined;
  const resolvedVersion = typeof result.data?.resolvedVersion === "string" ? result.data.resolvedVersion : undefined;
  if (ip) {
    const versionLabel = resolvedVersion === "4" ? "IPv4" : resolvedVersion === "6" ? "IPv6" : undefined;
    console.log(`IP: ${ip}${versionLabel ? ` (${versionLabel})` : ""}`);
  }

  const details = toRecord(result.data?.details);
  if (details) {
    const place = [asString(details.city), asString(details.country)].filter((value): value is string => Boolean(value)).join(", ");
    if (place) {
      const countryCode = asString(details.countryCode);
      console.log(countryCode ? `${place} (${countryCode})` : place);
    }

    const org = asString(details.org);
    if (org) {
      console.log(org);
    }
  } else {
    const detailsRequested = Boolean(result.data?.detailsRequested);
    const detailsError = asString(result.data?.detailsError);
    if (detailsRequested && detailsError) {
      console.log("Details: unavailable");
    }
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
