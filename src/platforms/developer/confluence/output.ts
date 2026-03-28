import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printConfluenceIdentityResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const user = result.data?.user as Record<string, unknown> | undefined;
  if (!user) {
    return;
  }

  const meta = [
    typeof user.displayName === "string" ? user.displayName : undefined,
    typeof user.email === "string" ? user.email : undefined,
    typeof user.type === "string" ? user.type : undefined,
    typeof user.id === "string" ? user.id : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof result.data?.siteUrl === "string") {
    console.log(result.data.siteUrl);
  }
}

export function printConfluenceListResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items =
    Array.isArray(result.data?.items) ? result.data.items
    : Array.isArray(result.data?.spaces) ? result.data.spaces
    : [];

  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      id?: string;
      key?: string;
      title?: string;
      name?: string;
      spaceKey?: string;
      spaceName?: string;
      updatedAt?: string;
      description?: string;
      bodyText?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${item.title ?? item.name ?? item.key ?? item.id ?? "Untitled"}`);
    const meta = [
      typeof item.key === "string" ? item.key : undefined,
      typeof item.spaceKey === "string" ? item.spaceKey : undefined,
      typeof item.spaceName === "string" ? item.spaceName : undefined,
      typeof item.updatedAt === "string" ? `updated ${item.updatedAt}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    const details = typeof item.description === "string" ? item.description : typeof item.bodyText === "string" ? item.bodyText : undefined;
    if (details?.trim()) {
      console.log(`   ${details.trim()}`);
    }
    if (typeof item.url === "string") {
      console.log(`   ${item.url}`);
    }
  }
}

export function printConfluencePageResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const page =
    (result.data?.page as Record<string, unknown> | undefined) ??
    (result.data?.comment as Record<string, unknown> | undefined);
  if (!page) {
    return;
  }

  if (typeof page.title === "string") {
    console.log(page.title);
  }

  const meta = [
    typeof page.spaceKey === "string" ? page.spaceKey : undefined,
    typeof page.spaceName === "string" ? page.spaceName : undefined,
    typeof page.updatedBy === "string" ? `by ${page.updatedBy}` : undefined,
    typeof page.updatedAt === "string" ? `updated ${page.updatedAt}` : undefined,
    typeof page.version === "number" ? `v${page.version}` : undefined,
    typeof page.author === "string" ? `author ${page.author}` : undefined,
    typeof page.createdAt === "string" ? `created ${page.createdAt}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof page.bodyText === "string" && page.bodyText.trim().length > 0) {
    console.log(page.bodyText.trim());
  }
  if (typeof page.url === "string") {
    console.log(page.url);
  }
}
