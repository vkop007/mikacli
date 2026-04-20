import { MikaCliError } from "../../../errors.js";
import { loadTextSource, loadTextSources, writeTextOutput } from "../shared/io.js";

import type { AdapterActionResult } from "../../../types.js";

type JsonPrimitive = null | boolean | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export class JsonDataAdapter {
  readonly platform = "json" as const;
  readonly displayName = "JSON";

  async format(input: { source: string; indent?: number; sortKeys?: boolean; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const parsed = parseJsonValue(loaded.content);
    const content = serializeJson(parsed, normalizeIndent(input.indent, 2), Boolean(input.sortKeys));
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "format",
      message: `Formatted JSON from ${loaded.label}.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }

  async query(input: { source: string; path: string; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const parsed = parseJsonValue(loaded.content);
    const value = getJsonAtPath(parsed, input.path);
    if (typeof value === "undefined") {
      throw new MikaCliError("DATA_JSON_PATH_NOT_FOUND", `JSON path "${input.path}" did not match anything.`, {
        details: {
          path: input.path,
          source: loaded.label,
        },
      });
    }

    const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "query",
      message: `Resolved JSON path ${input.path}.`,
      data: {
        source: loaded.label,
        path: input.path,
        outputPath,
        content,
        value,
      },
    };
  }

  async merge(input: { sources: string[]; indent?: number; sortKeys?: boolean; output?: string }): Promise<AdapterActionResult> {
    if (input.sources.length < 2) {
      throw new MikaCliError("DATA_JSON_MERGE_INPUTS_REQUIRED", "Provide at least two JSON inputs to merge.");
    }

    const loadedSources = await loadTextSources(input.sources);
    const values = loadedSources.map((entry) => parseJsonValue(entry.content));
    const merged = values.slice(1).reduce<JsonValue>((accumulator, current) => deepMergeJson(accumulator, current), values[0] as JsonValue);
    const content = serializeJson(merged, normalizeIndent(input.indent, 2), Boolean(input.sortKeys));
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "merge",
      message: `Merged ${loadedSources.length} JSON documents.`,
      data: {
        sources: loadedSources.map((entry) => entry.label),
        outputPath,
        content,
      },
    };
  }
}

export const jsonDataAdapter = new JsonDataAdapter();

function parseJsonValue(raw: string): JsonValue {
  try {
    return JSON.parse(raw) as JsonValue;
  } catch (error) {
    throw new MikaCliError("DATA_JSON_INVALID", "Input is not valid JSON.", {
      cause: error,
    });
  }
}

function normalizeIndent(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(8, Math.floor(value)));
}

function serializeJson(value: JsonValue, indent: number, sortKeys: boolean): string {
  const normalized = sortKeys ? sortJsonValue(value) : value;
  return JSON.stringify(normalized, null, indent);
}

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
      output[key] = sortJsonValue(value[key] as JsonValue);
    }
    return output;
  }

  return value;
}

function getJsonAtPath(value: JsonValue, path: string): JsonValue | undefined {
  const segments = parseJsonPath(path);
  let current: JsonValue | undefined = value;

  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
      continue;
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, JsonValue | undefined>)[segment];
  }

  return current;
}

function parseJsonPath(path: string): Array<string | number> {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new MikaCliError("DATA_JSON_PATH_INVALID", "Provide a JSON path like data.items[0].title.");
  }

  const segments: Array<string | number> = [];
  const pattern = /([^[.\]]+)|\[(\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\]/g;
  for (const match of trimmed.matchAll(pattern)) {
    if (match[1]) {
      segments.push(match[1]);
      continue;
    }

    const bracketValue = match[2];
    if (!bracketValue) {
      continue;
    }

    if (/^\d+$/.test(bracketValue)) {
      segments.push(Number.parseInt(bracketValue, 10));
    } else {
      segments.push(bracketValue.slice(1, -1));
    }
  }

  if (segments.length === 0) {
    throw new MikaCliError("DATA_JSON_PATH_INVALID", "Provide a JSON path like data.items[0].title.");
  }

  return segments;
}

function deepMergeJson(left: JsonValue, right: JsonValue): JsonValue {
  if (Array.isArray(left) && Array.isArray(right)) {
    return [...left, ...right];
  }

  if (isJsonObject(left) && isJsonObject(right)) {
    const output: Record<string, JsonValue> = { ...left };
    for (const [key, value] of Object.entries(right)) {
      output[key] = key in output ? deepMergeJson(output[key] as JsonValue, value) : value;
    }
    return output;
  }

  return right;
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
