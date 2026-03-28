import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";

import { AutoCliError } from "../../../errors.js";
import { loadTextSource, writeTextOutput } from "../shared/io.js";

import type { AdapterActionResult } from "../../../types.js";

type CsvRecord = Record<string, string>;

export class CsvDataAdapter {
  readonly platform = "csv" as const;
  readonly displayName = "CSV";

  async info(input: { source: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const table = parseCsvTable(loaded.content);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "info",
      message: `Loaded ${table.records.length} CSV row${table.records.length === 1 ? "" : "s"} from ${loaded.label}.`,
      data: {
        source: loaded.label,
        columns: table.headers,
        rowCount: table.records.length,
        preview: table.records.slice(0, 5),
      },
    };
  }

  async toJson(input: { source: string; indent?: number; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const table = parseCsvTable(loaded.content);
    const content = JSON.stringify(table.records, null, normalizeIndent(input.indent, 2));
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "to-json",
      message: `Converted ${table.records.length} CSV row${table.records.length === 1 ? "" : "s"} to JSON.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
        columns: table.headers,
        rowCount: table.records.length,
      },
    };
  }

  async filter(input: { source: string; where: string; format?: "csv" | "json"; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const table = parseCsvTable(loaded.content);
    const matcher = buildCsvFilter(input.where);
    const filtered = table.records.filter((record) => matcher(record));
    const format = input.format ?? "csv";
    const content =
      format === "json"
        ? JSON.stringify(filtered, null, 2)
        : stringifyCsv(filtered, {
            header: true,
            columns: table.headers,
          });
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "filter",
      message: `Filtered CSV down to ${filtered.length} row${filtered.length === 1 ? "" : "s"}.`,
      data: {
        source: loaded.label,
        where: input.where,
        format,
        outputPath,
        content,
        rowCount: filtered.length,
      },
    };
  }
}

export const csvDataAdapter = new CsvDataAdapter();

function parseCsvTable(raw: string): { headers: string[]; records: CsvRecord[] } {
  const rows = parseCsv(raw, {
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as string[][];

  const headers = rows[0]?.map((value, index) => {
    const trimmed = String(value ?? "").trim();
    return trimmed.length > 0 ? trimmed : `column_${index + 1}`;
  });

  if (!headers || headers.length === 0) {
    throw new AutoCliError("DATA_CSV_EMPTY", "CSV input did not contain a header row.");
  }

  const records = rows.slice(1).map((row) => {
    const record: CsvRecord = {};
    for (const [index, header] of headers.entries()) {
      record[header] = String(row[index] ?? "");
    }
    return record;
  });

  return { headers, records };
}

function buildCsvFilter(expression: string): (record: CsvRecord) => boolean {
  const match = expression.trim().match(/^([^=!<>~]+?)\s*(=|!=|>=|<=|>|<|~)\s*(.+)$/);
  if (!match?.[1] || !match[2]) {
    throw new AutoCliError("DATA_CSV_FILTER_INVALID", "Use a filter expression like status=done, amount>10, or name~john.");
  }

  const column = match[1].trim();
  const operator = match[2];
  const expected = stripCsvValueQuotes((match[3] ?? "").trim());

  return (record) => {
    const actual = record[column] ?? "";
    switch (operator) {
      case "=":
        return actual === expected;
      case "!=":
        return actual !== expected;
      case "~":
        return actual.toLowerCase().includes(expected.toLowerCase());
      case ">":
      case ">=":
      case "<":
      case "<=": {
        const left = Number.parseFloat(actual);
        const right = Number.parseFloat(expected);
        if (!Number.isFinite(left) || !Number.isFinite(right)) {
          return false;
        }
        if (operator === ">") return left > right;
        if (operator === ">=") return left >= right;
        if (operator === "<") return left < right;
        return left <= right;
      }
      default:
        return false;
    }
  };
}

function stripCsvValueQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeIndent(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(8, Math.floor(value)));
}
