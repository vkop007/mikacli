import type { AdapterActionResult } from "../../../types.js";

type PrintableRecord = Record<string, unknown>;

export function printGoogleResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printActionHeader(result);

  const entity = toRecord(result.data?.entity)
    ?? toRecord(result.data?.profile)
    ?? toRecord(result.data?.file)
    ?? toRecord(result.data?.message)
    ?? toRecord(result.data?.spreadsheet);
  if (entity) {
    printEntity(entity);
  }

  const items = Array.isArray(result.data?.items)
    ? result.data.items.filter((item): item is PrintableRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
  if (items.length > 0) {
    for (const [index, item] of items.entries()) {
      printItem(index + 1, item);
    }
  }
}

function printActionHeader(result: AdapterActionResult): void {
  console.log(result.message);

  if (result.user?.username) {
    console.log(`user: ${result.user.username}`);
  }

  if (result.id) {
    console.log(`id: ${result.id}`);
  }

  if (result.url) {
    console.log(`url: ${result.url}`);
  }

  if (result.sessionPath) {
    console.log(`session: ${result.sessionPath}`);
  }

  const nextCommand = readNextCommand(result);
  if (nextCommand) {
    console.log(`next: ${nextCommand}`);
  }
}

function printEntity(record: PrintableRecord): void {
  for (const key of [
    "displayName",
    "email",
    "username",
    "name",
    "title",
    "summary",
    "id",
    "subject",
    "start",
    "end",
    "timeZone",
    "accessRole",
    "range",
    "mimeType",
    "size",
    "modifiedTime",
    "webViewLink",
    "webContentLink",
    "snippet",
    "status",
  ] as const) {
    const value = record[key];
    if (value === undefined || value === null || `${value}`.trim().length === 0) {
      continue;
    }

    console.log(`${key}: ${value}`);
  }
}

function printItem(index: number, record: PrintableRecord): void {
  const title = firstString(record, ["name", "title", "summary", "subject", "email", "id"]) ?? `Item ${index}`;
  console.log(`${index}. ${title}`);

  const meta = [
    prefixed(record, "id"),
    prefixed(record, "email"),
    prefixed(record, "start"),
    prefixed(record, "end"),
    prefixed(record, "mimeType"),
    prefixed(record, "range"),
    prefixed(record, "size"),
    prefixed(record, "modifiedTime", "updated"),
    prefixed(record, "status"),
  ].filter((value): value is string => Boolean(value));
  if (meta.length > 0) {
    console.log(`   ${meta.join(" • ")}`);
  }

  const detail = firstString(record, ["snippet", "description", "webViewLink", "webContentLink"]);
  if (detail) {
    console.log(`   ${detail}`);
  }
}

function prefixed(record: PrintableRecord, key: string, label = key): string | undefined {
  const value = firstString(record, [key]);
  if (!value) {
    return undefined;
  }

  return label === value ? value : `${label} ${value}`;
}

function firstString(record: PrintableRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return undefined;
}

function toRecord(value: unknown): PrintableRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as PrintableRecord;
}

function readNextCommand(result: AdapterActionResult): string | undefined {
  const login = toRecord(result.data?.login);
  if (typeof login?.recommendedNextCommand === "string" && login.recommendedNextCommand.trim().length > 0) {
    return login.recommendedNextCommand.trim();
  }

  const guidance = toRecord(result.data?.guidance);
  if (typeof guidance?.recommendedNextCommand === "string" && guidance.recommendedNextCommand.trim().length > 0) {
    return guidance.recommendedNextCommand.trim();
  }

  return undefined;
}
