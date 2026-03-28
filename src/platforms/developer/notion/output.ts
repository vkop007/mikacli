import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printNotionIdentityResult(result: AdapterActionResult, json: boolean): void {
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
    typeof user.workspaceName === "string" ? user.workspaceName : undefined,
    typeof user.type === "string" ? user.type : undefined,
    typeof user.email === "string" ? user.email : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
}

export function printNotionListResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      object?: string;
      title?: string;
      id?: string;
      url?: string;
      updatedAt?: string;
      propertyNames?: string[];
      description?: string;
    };

    const meta = [
      typeof item.object === "string" ? item.object : undefined,
      Array.isArray(item.propertyNames) ? `${item.propertyNames.length} properties` : undefined,
      typeof item.updatedAt === "string" ? `updated ${item.updatedAt}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${item.title ?? item.id ?? "Untitled"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof item.description === "string" && item.description.trim().length > 0) {
      console.log(`   ${item.description.trim()}`);
    }
    if (typeof item.url === "string") {
      console.log(`   ${item.url}`);
    }
  }

  if (typeof result.data?.nextCursor === "string" && result.data.nextCursor.length > 0) {
    console.log(`next cursor: ${result.data.nextCursor}`);
  }
}

export function printNotionPageResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const page = result.data?.page as Record<string, unknown> | undefined;
  if (!page) {
    return;
  }

  const meta = [
    typeof page.object === "string" ? page.object : undefined,
    page.archived ? "archived" : undefined,
    page.inTrash ? "in trash" : undefined,
    typeof page.updatedAt === "string" ? `updated ${page.updatedAt}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof page.title === "string") {
    console.log(page.title);
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (Array.isArray(page.propertyNames) && page.propertyNames.length > 0) {
    console.log(`properties: ${page.propertyNames.join(", ")}`);
  }
  if (typeof page.url === "string") {
    console.log(page.url);
  }
}

export function printNotionDataSourceResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const dataSource = result.data?.dataSource as Record<string, unknown> | undefined;
  if (!dataSource) {
    return;
  }

  const meta = [
    typeof dataSource.object === "string" ? dataSource.object : undefined,
    Array.isArray(dataSource.propertyNames) ? `${dataSource.propertyNames.length} properties` : undefined,
    typeof dataSource.updatedAt === "string" ? `updated ${dataSource.updatedAt}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (typeof dataSource.title === "string") {
    console.log(dataSource.title);
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof dataSource.description === "string" && dataSource.description.trim().length > 0) {
    console.log(dataSource.description.trim());
  }
  if (Array.isArray(dataSource.propertyNames) && dataSource.propertyNames.length > 0) {
    console.log(`properties: ${dataSource.propertyNames.join(", ")}`);
  }
  if (typeof dataSource.url === "string") {
    console.log(dataSource.url);
  }
}

