import pc from "picocolors";

import { errorToJson, isAutoCliError } from "../errors.js";

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printStatusTable(
  rows: Array<{
    platform: string;
    account: string;
    status: string;
    user?: string;
    message?: string;
  }>,
): void {
  if (rows.length === 0) {
    console.log(pc.dim("No connected accounts found."));
    return;
  }

  const widths = {
    platform: Math.max(...rows.map((row) => row.platform.length), "platform".length),
    account: Math.max(...rows.map((row) => row.account.length), "account".length),
    status: Math.max(...rows.map((row) => row.status.length), "status".length),
    user: Math.max(...rows.map((row) => (row.user ?? "-").length), "user".length),
  };

  const header = [
    "platform".padEnd(widths.platform),
    "account".padEnd(widths.account),
    "status".padEnd(widths.status),
    "user".padEnd(widths.user),
    "message",
  ].join("  ");

  console.log(pc.bold(header));
  console.log(
    [
      "-".repeat(widths.platform),
      "-".repeat(widths.account),
      "-".repeat(widths.status),
      "-".repeat(widths.user),
      "-".repeat(20),
    ].join("  "),
  );

  for (const row of rows) {
    console.log(
      [
        row.platform.padEnd(widths.platform),
        row.account.padEnd(widths.account),
        colorizeStatus(row.status).padEnd(widths.status + visibleColorPadding(row.status)),
        (row.user ?? "-").padEnd(widths.user),
        row.message ?? "",
      ].join("  "),
    );
  }
}

function colorizeStatus(status: string): string {
  switch (status) {
    case "active":
      return pc.green(status);
    case "expired":
      return pc.red(status);
    default:
      return pc.yellow(status);
  }
}

function visibleColorPadding(status: string): number {
  return status === "active" ? 9 : status === "expired" ? 9 : 9;
}

export function printError(error: unknown, json: boolean): never {
  if (json) {
    printJson(errorToJson(error));
  } else if (isAutoCliError(error)) {
    console.error(`${pc.red("error")} ${error.message}`);

    if (error.details && Object.keys(error.details).length > 0) {
      console.error(pc.dim(JSON.stringify(error.details, null, 2)));
    }
  } else if (error instanceof Error) {
    console.error(`${pc.red("error")} ${error.message}`);
  } else {
    console.error(`${pc.red("error")} Unknown error`);
  }

  process.exitCode = isAutoCliError(error) ? error.exitCode : 1;
  throw error;
}
