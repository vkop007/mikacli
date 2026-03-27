import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printPdfResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const outputDir = asString(data.outputDir);
  const pages = asNumber(data.pages);
  const angle = asString(data.angle) ?? asNumber(data.angle)?.toString();
  const sizeBytes = asNumber(data.sizeBytes);
  const encrypted = typeof data.encrypted === "boolean" ? data.encrypted : undefined;
  const optimized = typeof data.optimized === "boolean" ? data.optimized : undefined;
  const linearized = typeof data.linearized === "boolean" ? data.linearized : undefined;
  const decrypted = typeof data.decrypted === "boolean" ? data.decrypted : undefined;
  const bits = asNumber(data.bits);
  const outputPaths = Array.isArray(data.outputPaths) ? data.outputPaths.filter((value): value is string => typeof value === "string") : [];
  const pageSpec = asString(data.pageSpec);

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (outputDir) {
    console.log(`dir: ${outputDir}`);
  }

  if (typeof pages === "number") {
    console.log(`pages: ${pages}`);
  }

  if (typeof encrypted === "boolean") {
    console.log(`encrypted: ${encrypted ? "yes" : "no"}`);
  }

  if (typeof decrypted === "boolean") {
    console.log(`decrypted: ${decrypted ? "yes" : "no"}`);
  }

  if (typeof optimized === "boolean") {
    console.log(`optimized: ${optimized ? "yes" : "no"}`);
  }

  if (typeof linearized === "boolean") {
    console.log(`linearized: ${linearized ? "yes" : "no"}`);
  }

  if (typeof bits === "number") {
    console.log(`bits: ${bits}`);
  }

  if (typeof angle === "string") {
    console.log(`angle: ${angle}`);
  }

  if (pageSpec) {
    console.log(`pages: ${pageSpec}`);
  }

  if (typeof sizeBytes === "number") {
    console.log(`bytes: ${sizeBytes}`);
  }

  if (outputPaths.length > 0) {
    console.log("files:");
    for (const item of outputPaths) {
      console.log(`  - ${item}`);
    }
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
