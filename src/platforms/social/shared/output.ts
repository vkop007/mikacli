import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printSocialSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? (result.data.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log("No results found.");
    return;
  }

  for (const item of items) {
    printSocialEntry(item);
  }
}

export function printSocialProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const profile = (result.data?.profile ?? {}) as Record<string, unknown>;
  for (const key of ["displayName", "username", "did", "bio", "followers", "following", "posts", "url"]) {
    const value = profile[key];
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      console.log(`${key}: ${value}`);
    }
  }
}

export function printSocialPostsResult(result: AdapterActionResult, json: boolean, emptyLabel = "posts"): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? (result.data.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log(`No ${emptyLabel} found.`);
    return;
  }

  for (const item of items) {
    printSocialEntry(item);
  }
}

export function printSocialThreadResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const thread = (result.data?.thread ?? {}) as Record<string, unknown>;
  const replies = Array.isArray(result.data?.replies) ? (result.data.replies as Array<Record<string, unknown>>) : [];

  console.log("thread:");
  printSocialEntry(thread);

  if (replies.length === 0) {
    console.log("No replies found.");
    return;
  }

  console.log("replies:");
  for (const reply of replies) {
    printSocialEntry(reply);
  }
}

function printSocialEntry(item: Record<string, unknown>): void {
  const heading = pickFirstString(item.title, item.text, item.displayName, item.username, item.id) ?? "-";
  console.log(heading);

  const fields: Array<[string, unknown]> = [
    ["id", item.id],
    ["username", item.username],
    ["did", item.did],
    ["date", item.publishedAt],
    ["followers", item.followers],
    ["summary", item.summary],
    ["text", item.text && item.text !== heading ? item.text : undefined],
    ["metrics", Array.isArray(item.metrics) ? item.metrics.join(", ") : item.metrics],
    ["url", item.url],
  ];

  for (const [label, value] of fields) {
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      console.log(`${label}: ${value}`);
    }
  }

  console.log("");
}

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}
