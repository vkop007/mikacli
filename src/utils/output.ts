import pc from "picocolors";

import { isAutoCliError } from "../errors.js";
import { serializeCliError } from "./error-recovery.js";

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
        padAnsi(colorizeStatus(row.status), widths.status),
        (row.user ?? "-").padEnd(widths.user),
        row.message ?? "",
      ].join("  "),
    );
  }
}

export function printSessionsTable(
  rows: Array<{
    platform: string;
    account: string;
    auth: string;
    status: string;
    updated: string;
    path: string;
  }>,
): void {
  if (rows.length === 0) {
    console.log(pc.dim("No saved sessions or connections found."));
    return;
  }

  const widths = {
    platform: Math.max(...rows.map((row) => row.platform.length), "platform".length),
    account: Math.max(...rows.map((row) => row.account.length), "account".length),
    auth: Math.max(...rows.map((row) => row.auth.length), "auth".length),
    status: Math.max(...rows.map((row) => row.status.length), "status".length),
    updated: Math.max(...rows.map((row) => row.updated.length), "updated".length),
  };

  const header = [
    "platform".padEnd(widths.platform),
    "account".padEnd(widths.account),
    "auth".padEnd(widths.auth),
    "status".padEnd(widths.status),
    "updated".padEnd(widths.updated),
    "path",
  ].join("  ");

  console.log(pc.bold(header));
  console.log(
    [
      "-".repeat(widths.platform),
      "-".repeat(widths.account),
      "-".repeat(widths.auth),
      "-".repeat(widths.status),
      "-".repeat(widths.updated),
      "-".repeat(20),
    ].join("  "),
  );

  for (const row of rows) {
    console.log(
      [
        row.platform.padEnd(widths.platform),
        row.account.padEnd(widths.account),
        row.auth.padEnd(widths.auth),
        padAnsi(colorizeStatus(row.status), widths.status),
        row.updated.padEnd(widths.updated),
        row.path,
      ].join("  "),
    );
  }
}

export function printDoctorTable(
  rows: Array<{
    check: string;
    status: "pass" | "warn" | "fail";
    message: string;
  }>,
): void {
  if (rows.length === 0) {
    console.log(pc.dim("No doctor checks ran."));
    return;
  }

  const widths = {
    check: Math.max(...rows.map((row) => row.check.length), "check".length),
    status: Math.max(...rows.map((row) => row.status.length), "status".length),
  };

  const header = ["check".padEnd(widths.check), "status".padEnd(widths.status), "message"].join("  ");
  console.log(pc.bold(header));
  console.log(["-".repeat(widths.check), "-".repeat(widths.status), "-".repeat(20)].join("  "));

  for (const row of rows) {
    console.log([row.check.padEnd(widths.check), padAnsi(colorizeDoctorStatus(row.status), widths.status), row.message].join("  "));
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

function colorizeDoctorStatus(status: "pass" | "warn" | "fail"): string {
  switch (status) {
    case "pass":
      return pc.green(status);
    case "warn":
      return pc.yellow(status);
    case "fail":
      return pc.red(status);
  }
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-9;]*m/g, "");
}

function padAnsi(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - stripAnsi(value).length));
}

export function printError(error: unknown, json: boolean): never {
  const serialized = serializeCliError(error);
  if (json) {
    printJson(serialized);
  } else if (isAutoCliError(error)) {
    console.error(`${pc.red("error")} ${serialized.error.message}`);

    if (error.details && Object.keys(error.details).length > 0) {
      console.error(pc.dim(JSON.stringify(error.details, null, 2)));
    }

    if (serialized.error.nextCommand) {
      console.error(`next: ${serialized.error.nextCommand}`);
    }

    if (serialized.error.hint) {
      console.error(pc.dim(`hint: ${serialized.error.hint}`));
    }
  } else if (error instanceof Error) {
    console.error(`${pc.red("error")} ${serialized.error.message}`);
    if (serialized.error.nextCommand) {
      console.error(`next: ${serialized.error.nextCommand}`);
    }
    if (serialized.error.hint) {
      console.error(pc.dim(`hint: ${serialized.error.hint}`));
    }
  } else {
    console.error(`${pc.red("error")} Unknown error`);
  }

  process.exitCode = isAutoCliError(error) ? error.exitCode : 1;
  throw error;
}
