import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

type PrintableRecord = Record<string, unknown>;

export function printDevopsIdentityResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const user = (result.data?.user as PrintableRecord | undefined) ?? toRecord(result.user);
  if (!user) {
    return;
  }

  const meta = [
    asString(user.displayName),
    asString(user.username),
    asString(user.email),
    asString(user.id),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
}

export function printDevopsListResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = extractList(result.data);
  if (items.length === 0) {
    return;
  }

  for (const [index, item] of items.entries()) {
    const title = firstString(item, ["name", "displayName", "slug", "url", "title", "ref", "username", "id"]) ?? `Item ${index + 1}`;
    console.log(`${index + 1}. ${title}`);

    const meta = [
      prefixed(item, "id"),
      prefixed(item, "status"),
      prefixed(item, "type"),
      prefixed(item, "plan"),
      prefixed(item, "framework"),
      prefixed(item, "region"),
      prefixed(item, "environment"),
      prefixed(item, "projectRef"),
      prefixed(item, "accountName"),
      prefixed(item, "teamName"),
      prefixed(item, "organizationName"),
      prefixed(item, "projectName"),
      prefixed(item, "createdAt", "created"),
      prefixed(item, "updatedAt", "updated"),
    ].filter((value): value is string => Boolean(value));

    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }

    const detail = firstString(item, ["content", "description", "domain", "email", "scope"]);
    if (detail) {
      console.log(`   ${detail}`);
    }

    const url = firstString(item, ["url"]);
    if (url) {
      console.log(`   ${url}`);
    }
  }
}

function extractList(data: Record<string, unknown> | undefined): PrintableRecord[] {
  if (!data) {
    return [];
  }

  for (const key of ["accounts", "zones", "records", "teams", "projects", "deployments", "organizations", "functions", "services", "envGroups", "sites", "apps", "domains", "machines", "volumes", "certificates"]) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is PrintableRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    }
  }

  return [];
}

function prefixed(record: PrintableRecord, key: string, label = key): string | undefined {
  const value = asString(record[key]);
  if (!value) {
    return undefined;
  }

  return label === value ? value : `${label} ${value}`;
}

function firstString(record: PrintableRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function toRecord(value: unknown): PrintableRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as PrintableRecord;
}
