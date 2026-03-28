import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printFaviconResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  if (typeof data.faviconUrl === "string") {
    console.log(`favicon: ${data.faviconUrl}`);
  }
  if (typeof data.finalUrl === "string") {
    console.log(`page: ${data.finalUrl}`);
  }

  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  if (candidates.length === 0) {
    return;
  }

  console.log("candidates:");
  for (const [index, rawCandidate] of candidates.entries()) {
    if (!rawCandidate || typeof rawCandidate !== "object") {
      continue;
    }

    const candidate = rawCandidate as {
      url?: string;
      rel?: string;
      source?: string;
      reachable?: boolean;
      contentType?: string | null;
      sizes?: string;
    };

    const label = typeof candidate.url === "string" ? candidate.url : "unknown";
    const meta = [
      typeof candidate.rel === "string" ? candidate.rel : undefined,
      typeof candidate.source === "string" ? candidate.source : undefined,
      candidate.reachable === true ? "ok" : candidate.reachable === false ? "missing" : undefined,
      typeof candidate.contentType === "string" ? candidate.contentType : undefined,
      typeof candidate.sizes === "string" ? candidate.sizes : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${label}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}
