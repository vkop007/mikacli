import { GoogleApiClient } from "../shared/client.js";

export interface GoogleSheetInfo {
  sheetId?: number;
  title?: string;
  index?: number;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetSummary {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  title?: string;
  locale?: string;
  timeZone?: string;
  sheets: GoogleSheetInfo[];
}

export interface SheetValuesResult {
  range?: string;
  majorDimension?: string;
  values?: unknown[][];
}

export class SheetsApiClient {
  private readonly client: GoogleApiClient;

  constructor(accessToken: string, fetchImpl?: typeof fetch) {
    this.client = new GoogleApiClient({
      accessToken,
      baseUrl: "https://sheets.googleapis.com/v4/spreadsheets",
      errorCode: "SHEETS_API_ERROR",
      fetchImpl,
    });
  }

  async createSpreadsheet(input: { title: string; sheetTitle?: string }): Promise<SpreadsheetSummary> {
    const payload = await this.client.json<Record<string, unknown>>("", {
      method: "POST",
      body: {
        properties: {
          title: input.title,
        },
        ...(input.sheetTitle ? { sheets: [{ properties: { title: input.sheetTitle } }] } : {}),
      },
    });

    return summarizeSpreadsheet(payload);
  }

  async getSpreadsheet(id: string): Promise<SpreadsheetSummary> {
    const payload = await this.client.json<Record<string, unknown>>(`/${encodeURIComponent(id)}`, {}, {
      includeGridData: false,
    });
    return summarizeSpreadsheet(payload);
  }

  async getValues(input: { spreadsheetId: string; range: string }): Promise<SheetValuesResult> {
    return this.client.json<SheetValuesResult>(`/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(input.range)}`);
  }

  async appendValues(input: {
    spreadsheetId: string;
    range: string;
    values: unknown[][];
    valueInputOption?: string;
  }): Promise<Record<string, unknown>> {
    return this.client.json<Record<string, unknown>>(
      `/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(input.range)}:append`,
      {
        method: "POST",
        body: {
          values: input.values,
        },
      },
      {
        valueInputOption: input.valueInputOption ?? "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
      },
    );
  }

  async updateValues(input: {
    spreadsheetId: string;
    range: string;
    values: unknown[][];
    valueInputOption?: string;
  }): Promise<Record<string, unknown>> {
    return this.client.json<Record<string, unknown>>(
      `/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(input.range)}`,
      {
        method: "PUT",
        body: {
          values: input.values,
        },
      },
      {
        valueInputOption: input.valueInputOption ?? "USER_ENTERED",
      },
    );
  }

  async clearValues(input: { spreadsheetId: string; range: string }): Promise<Record<string, unknown>> {
    return this.client.json<Record<string, unknown>>(
      `/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(input.range)}:clear`,
      {
        method: "POST",
        body: {},
      },
    );
  }
}

function summarizeSpreadsheet(payload: Record<string, unknown>): SpreadsheetSummary {
  const properties = toRecord(payload.properties);
  const sheets = Array.isArray(payload.sheets) ? payload.sheets : [];

  return {
    ...(typeof payload.spreadsheetId === "string" ? { spreadsheetId: payload.spreadsheetId } : {}),
    ...(typeof payload.spreadsheetUrl === "string" ? { spreadsheetUrl: payload.spreadsheetUrl } : {}),
    ...(typeof properties?.title === "string" ? { title: properties.title } : {}),
    ...(typeof properties?.locale === "string" ? { locale: properties.locale } : {}),
    ...(typeof properties?.timeZone === "string" ? { timeZone: properties.timeZone } : {}),
    sheets: sheets.map((sheet) => summarizeSheet(sheet)).filter((item) => Object.keys(item).length > 0),
  };
}

function summarizeSheet(value: unknown): GoogleSheetInfo {
  const properties = toRecord(toRecord(value)?.properties);
  if (!properties) {
    return {};
  }

  const gridProperties = toRecord(properties.gridProperties);
  return {
    ...(typeof properties.sheetId === "number" ? { sheetId: properties.sheetId } : {}),
    ...(typeof properties.title === "string" ? { title: properties.title } : {}),
    ...(typeof properties.index === "number" ? { index: properties.index } : {}),
    ...(typeof gridProperties?.rowCount === "number" ? { rowCount: gridProperties.rowCount } : {}),
    ...(typeof gridProperties?.columnCount === "number" ? { columnCount: gridProperties.columnCount } : {}),
  };
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}
