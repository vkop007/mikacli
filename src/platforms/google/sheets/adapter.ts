import { SheetsApiClient } from "./client.js";
import { BaseGooglePlatformAdapter } from "../shared/base.js";

import type { AdapterActionResult } from "../../../types.js";

export class SheetsAdapter extends BaseGooglePlatformAdapter {
  readonly platform = "sheets" as const;
  protected readonly defaultScopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/spreadsheets",
  ] as const;

  async create(input: { account?: string; title: string; sheetTitle?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const spreadsheet = await this.createClient(active.accessToken).createSpreadsheet({
      title: input.title,
      sheetTitle: input.sheetTitle,
    });

    return this.buildActionResult({
      account: active.account,
      action: "create",
      message: `Created Google Sheet ${input.title}.`,
      sessionPath: active.path,
      user: active.user,
      id: spreadsheet.spreadsheetId,
      url: spreadsheet.spreadsheetUrl,
      data: {
        spreadsheet,
      },
    });
  }

  async spreadsheet(input: { account?: string; spreadsheetId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const spreadsheet = await this.createClient(active.accessToken).getSpreadsheet(input.spreadsheetId);

    return this.buildActionResult({
      account: active.account,
      action: "spreadsheet",
      message: `Loaded Google Sheet ${input.spreadsheetId}.`,
      sessionPath: active.path,
      user: active.user,
      id: spreadsheet.spreadsheetId,
      url: spreadsheet.spreadsheetUrl,
      data: {
        spreadsheet,
      },
    });
  }

  async values(input: { account?: string; spreadsheetId: string; range: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const values = await this.createClient(active.accessToken).getValues(input);

    return this.buildActionResult({
      account: active.account,
      action: "values",
      message: `Loaded values for ${input.range}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        range: values.range,
        values: values.values ?? [],
      },
    });
  }

  async append(input: {
    account?: string;
    spreadsheetId: string;
    range: string;
    values: unknown[][];
    valueInputOption?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const result = await this.createClient(active.accessToken).appendValues(input);

    return this.buildActionResult({
      account: active.account,
      action: "append",
      message: `Appended values to ${input.range}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        entity: {
          range: input.range,
          spreadsheetId: input.spreadsheetId,
          updates: result.updates,
        },
      },
    });
  }

  async update(input: {
    account?: string;
    spreadsheetId: string;
    range: string;
    values: unknown[][];
    valueInputOption?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const result = await this.createClient(active.accessToken).updateValues(input);

    return this.buildActionResult({
      account: active.account,
      action: "update",
      message: `Updated values in ${input.range}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        entity: {
          range: result.updatedRange ?? input.range,
          spreadsheetId: input.spreadsheetId,
          updatedRows: result.updatedRows,
          updatedColumns: result.updatedColumns,
          updatedCells: result.updatedCells,
        },
      },
    });
  }

  async clear(input: { account?: string; spreadsheetId: string; range: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const result = await this.createClient(active.accessToken).clearValues(input);

    return this.buildActionResult({
      account: active.account,
      action: "clear",
      message: `Cleared values in ${input.range}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        entity: {
          range: result.clearedRange ?? input.range,
          spreadsheetId: input.spreadsheetId,
          status: "cleared",
        },
      },
    });
  }

  private createClient(accessToken: string): SheetsApiClient {
    return new SheetsApiClient(accessToken, this.fetchImpl);
  }
}

export const sheetsAdapter = new SheetsAdapter();
