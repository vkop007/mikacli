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
  const removedPages = formatPageNumbers(data.removedPages);
  const remainingPages = formatPageNumbers(data.remainingPages);
  const updated = typeof data.updated === "boolean" ? data.updated : undefined;
  const updatedFields = Array.isArray(data.updatedFields) ? data.updatedFields.filter((value): value is string => typeof value === "string") : [];
  const metadata = isRecord(data.metadata) ? data.metadata : undefined;

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

  if (removedPages) {
    console.log(`removed pages: ${removedPages}`);
  }

  if (remainingPages) {
    console.log(`remaining pages: ${remainingPages}`);
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

  if (typeof updated === "boolean") {
    console.log(`updated: ${updated ? "yes" : "no"}`);
  }

  if (updatedFields.length > 0) {
    console.log(`fields: ${updatedFields.join(", ")}`);
  }

  if (metadata) {
    console.log("metadata:");
    console.log(`  title: ${formatMetadataValue(metadata.title)}`);
    console.log(`  author: ${formatMetadataValue(metadata.author)}`);
    console.log(`  subject: ${formatMetadataValue(metadata.subject)}`);
    console.log(`  keywords: ${formatMetadataKeywords(metadata.keywords)}`);
    console.log(`  creator: ${formatMetadataValue(metadata.creator)}`);
    console.log(`  producer: ${formatMetadataValue(metadata.producer)}`);
    console.log(`  creationDate: ${formatMetadataValue(metadata.creationDate)}`);
    console.log(`  modificationDate: ${formatMetadataValue(metadata.modificationDate)}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return "unset";
}

function formatMetadataKeywords(value: unknown): string {
  if (typeof value === "string") {
    const keywords = value
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);
    return keywords.length > 0 ? keywords.join(", ") : "unset";
  }

  if (!Array.isArray(value) || value.length === 0) {
    return "unset";
  }

  const keywords = value.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0);
  return keywords.length > 0 ? keywords.join(", ") : "unset";
}

function formatPageNumbers(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const pages = value.filter((page): page is number => typeof page === "number" && Number.isInteger(page) && page > 0).sort((left, right) => left - right);
  if (pages.length === 0) {
    return undefined;
  }

  const ranges: string[] = [];
  let start = pages[0]!;
  let end = start;

  for (let index = 1; index < pages.length; index += 1) {
    const page = pages[index]!;
    if (page === end + 1) {
      end = page;
      continue;
    }

    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = page;
    end = page;
  }

  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(",");
}
