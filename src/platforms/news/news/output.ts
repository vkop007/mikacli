import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printNewsSourcesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const sources = Array.isArray(result.data?.sources) ? result.data.sources : [];

  for (const [index, rawSource] of sources.entries()) {
    if (!rawSource || typeof rawSource !== "object") {
      continue;
    }

    const source = rawSource as {
      scope?: string;
      label?: string;
      description?: string;
      supportsTop?: boolean;
      supportsSearch?: boolean;
      supportsFeed?: boolean;
      defaultHint?: string;
    };

    const supportBits = [
      source.supportsTop ? "top" : undefined,
      source.supportsSearch ? "search" : undefined,
      source.supportsFeed ? "feed" : undefined,
    ].filter((value): value is string => Boolean(value));

    console.log(`${index + 1}. ${source.label ?? source.scope ?? "unknown"}`);
    console.log(`   id: ${source.scope ?? "-"}`);
    if (typeof source.description === "string" && source.description.trim().length > 0) {
      console.log(`   ${source.description.trim()}`);
    }
    if (supportBits.length > 0) {
      console.log(`   supports: ${supportBits.join(", ")}`);
    }
    if (typeof source.defaultHint === "string" && source.defaultHint.trim().length > 0) {
      console.log(`   hint: ${source.defaultHint.trim()}`);
    }
  }
}

export function printNewsItemsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  if (items.length === 0) {
    console.log("No news items found.");
    return;
  }

  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      sourceLabel?: string;
      title?: string;
      url?: string;
      snippet?: string;
      summary?: string;
      publishedAt?: string;
      author?: string;
      feedTitle?: string;
    };

    console.log(`${index + 1}. [${item.sourceLabel ?? "news"}] ${item.title ?? "Untitled story"}`);
    if (typeof item.summary === "string" && item.summary.trim().length > 0) {
      console.log(`   summary: ${item.summary.trim()}`);
    } else if (typeof item.snippet === "string" && item.snippet.trim().length > 0) {
      console.log(`   ${item.snippet.trim()}`);
    }

    const meta = [
      typeof item.author === "string" && item.author.trim().length > 0 ? `by ${item.author.trim()}` : undefined,
      typeof item.publishedAt === "string" && item.publishedAt.trim().length > 0 ? item.publishedAt.trim() : undefined,
      typeof item.feedTitle === "string" && item.feedTitle.trim().length > 0 ? item.feedTitle.trim() : undefined,
    ].filter((value): value is string => Boolean(value));

    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }

    if (typeof item.url === "string" && item.url.trim().length > 0) {
      console.log(`   ${item.url.trim()}`);
    }
  }
}
