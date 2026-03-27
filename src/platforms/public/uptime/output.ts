import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printUptimeResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const url = asString(data.finalUrl) ?? asString(data.target);
  const status = typeof data.status === "number" ? data.status : undefined;
  const statusText = asString(data.statusText);
  const latencyMs = typeof data.latencyMs === "number" ? data.latencyMs : undefined;
  const method = asString(data.method);
  const contentType = asString(data.contentType);
  const contentLength = typeof data.contentLength === "number" ? data.contentLength : undefined;

  if (url) {
    console.log(url);
  }

  if (typeof status === "number") {
    console.log(`status: ${status}${statusText ? ` ${statusText}` : ""}`);
  }

  if (typeof latencyMs === "number") {
    console.log(`latency: ${latencyMs} ms${method ? ` via ${method}` : ""}`);
  }

  if (contentType) {
    console.log(`content-type: ${contentType}`);
  }

  if (typeof contentLength === "number") {
    console.log(`content-length: ${contentLength}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
