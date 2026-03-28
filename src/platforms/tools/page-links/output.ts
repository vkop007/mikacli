import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printPageLinksResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  if (typeof data.finalUrl === "string") {
    console.log(`page: ${data.finalUrl}`);
  }
  if (typeof data.total === "number") {
    console.log(`total: ${data.total}`);
  }
  if (typeof data.internalCount === "number") {
    console.log(`internal: ${data.internalCount}`);
  }
  if (typeof data.externalCount === "number") {
    console.log(`external: ${data.externalCount}`);
  }

  const links = Array.isArray(data.links) ? data.links : [];
  if (links.length === 0) {
    return;
  }

  console.log("links:");
  for (const [index, rawLink] of links.entries()) {
    if (!rawLink || typeof rawLink !== "object") {
      continue;
    }

    const link = rawLink as {
      url?: string;
      text?: string;
      kind?: string;
    };

    console.log(`${index + 1}. ${typeof link.url === "string" ? link.url : "unknown"}`);
    const meta = [
      typeof link.kind === "string" ? link.kind : undefined,
      typeof link.text === "string" && link.text.length > 0 ? link.text : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}
