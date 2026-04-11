import { Command } from "commander";

import { runGoogleAction, parseGoogleScopes, parseJsonTable, parseTimeoutSeconds } from "../shared/command.js";
import { sheetsAdapter } from "./adapter.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli google sheets login --client-id google-client-id-example --client-secret google-client-secret-example",
  "autocli google sheets auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback",
  "autocli google sheets login --client-id google-client-id-example --client-secret google-client-secret-example --refresh-token google-refresh-token-example",
  'autocli google sheets create "AutoCLI Demo" --sheet "Sheet1" --json',
  "autocli google sheets spreadsheet google-sheet-id-example --json",
  "autocli google sheets values google-sheet-id-example Sheet1!A1:B10 --json",
  'autocli google sheets append google-sheet-id-example Sheet1!A:B --values "[[\\"Alice\\",42],[\\"Bob\\",7]]" --json',
  'autocli google sheets update google-sheet-id-example Sheet1!A1:B2 --values "[[\\"Name\\",\\"Score\\"]]" --json',
] as const;

function buildSheetsCommand(_options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("sheets").description("Use Google Sheets through Google's OAuth2 APIs");

  command
    .command("auth-url")
    .description("Generate the Google OAuth consent URL for Sheets")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--state <value>", "Optional OAuth state value")
    .option("--login-hint <email>", "Optional Google account email hint")
    .action(async (input: { clientId: string; redirectUri: string; scopes?: string[]; state?: string; loginHint?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "auth-url",
        spinnerText: "Generating Sheets OAuth consent URL...",
        successMessage: "Sheets OAuth consent URL generated.",
        action: () => sheetsAdapter.authUrl(input),
      });
    });

  command
    .command("login")
    .description("Save a Sheets OAuth2 connection with localhost callback capture, an authorization code, or a refresh token")
    .option("--account <name>", "Optional saved connection name")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--client-secret <secret>", "Google OAuth client secret")
    .option("--code <value>", "Authorization code returned from Google's consent flow")
    .option("--redirect-uri <uri>", "Optional localhost redirect URI to listen on during interactive login, or the URI used with --code")
    .option("--refresh-token <token>", "Existing Google refresh token")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--timeout <seconds>", "Maximum seconds to wait for the localhost callback during interactive login", parseTimeoutSeconds, 300)
    .option("--login-hint <email>", "Optional Google account email hint for interactive login")
    .action(async (input: {
      account?: string;
      clientId: string;
      clientSecret: string;
      code?: string;
      redirectUri?: string;
      refreshToken?: string;
      scopes?: string[];
      timeout: number;
      loginHint?: string;
    }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "login",
        spinnerText: "Saving Sheets OAuth connection...",
        successMessage: "Sheets OAuth connection saved.",
        action: () => sheetsAdapter.login({
          account: input.account,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          code: input.code,
          redirectUri: input.redirectUri,
          refreshToken: input.refreshToken,
          scopes: input.scopes,
          timeoutSeconds: input.timeout,
          loginHint: input.loginHint,
        }),
      });
    });

  command
    .command("status")
    .description("Check the saved Sheets OAuth connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "status",
        spinnerText: "Checking Sheets connection...",
        successMessage: "Sheets connection checked.",
        action: () => sheetsAdapter.statusAction(input.account),
      });
    });

  command
    .command("me")
    .description("Show the current Google profile behind the Sheets connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "me",
        spinnerText: "Loading Sheets profile...",
        successMessage: "Sheets profile loaded.",
        action: () => sheetsAdapter.me(input.account),
      });
    });

  command
    .command("create")
    .description("Create a new spreadsheet")
    .argument("<title>", "Spreadsheet title")
    .option("--sheet <name>", "Optional first sheet title")
    .option("--account <name>", "Optional saved connection name")
    .action(async (title: string, input: { sheet?: string; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "create",
        spinnerText: "Creating spreadsheet...",
        successMessage: "Spreadsheet created.",
        action: () => sheetsAdapter.create({ account: input.account, title, sheetTitle: input.sheet }),
      });
    });

  command
    .command("spreadsheet")
    .description("Load spreadsheet metadata")
    .argument("<spreadsheet-id>", "Spreadsheet id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (spreadsheetId: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "spreadsheet",
        spinnerText: "Loading spreadsheet metadata...",
        successMessage: "Spreadsheet metadata loaded.",
        action: () => sheetsAdapter.spreadsheet({ account: input.account, spreadsheetId }),
      });
    });

  command
    .command("values")
    .description("Read a range from a spreadsheet")
    .argument("<spreadsheet-id>", "Spreadsheet id")
    .argument("<range>", "A1-style range, for example Sheet1!A1:B10")
    .option("--account <name>", "Optional saved connection name")
    .action(async (spreadsheetId: string, range: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "values",
        spinnerText: "Loading sheet values...",
        successMessage: "Sheet values loaded.",
        action: () => sheetsAdapter.values({ account: input.account, spreadsheetId, range }),
      });
    });

  command
    .command("append")
    .description("Append rows to a spreadsheet range")
    .argument("<spreadsheet-id>", "Spreadsheet id")
    .argument("<range>", "A1-style range, for example Sheet1!A:B")
    .requiredOption("--values <json>", "JSON array of rows, for example [[\"Alice\",42]]", parseJsonTable)
    .option("--input-option <mode>", "RAW or USER_ENTERED value input mode", "USER_ENTERED")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      spreadsheetId: string,
      range: string,
      input: { values: unknown[][]; inputOption?: string; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "append",
        spinnerText: "Appending sheet values...",
        successMessage: "Sheet values appended.",
        action: () =>
          sheetsAdapter.append({
            account: input.account,
            spreadsheetId,
            range,
            values: input.values,
            valueInputOption: input.inputOption,
          }),
      });
    });

  command
    .command("update")
    .description("Update a spreadsheet range")
    .argument("<spreadsheet-id>", "Spreadsheet id")
    .argument("<range>", "A1-style range, for example Sheet1!A1:B2")
    .requiredOption("--values <json>", "JSON array of rows, for example [[\"Alice\",42]]", parseJsonTable)
    .option("--input-option <mode>", "RAW or USER_ENTERED value input mode", "USER_ENTERED")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      spreadsheetId: string,
      range: string,
      input: { values: unknown[][]; inputOption?: string; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "update",
        spinnerText: "Updating sheet values...",
        successMessage: "Sheet values updated.",
        action: () =>
          sheetsAdapter.update({
            account: input.account,
            spreadsheetId,
            range,
            values: input.values,
            valueInputOption: input.inputOption,
          }),
      });
    });

  command
    .command("clear")
    .description("Clear a spreadsheet range")
    .argument("<spreadsheet-id>", "Spreadsheet id")
    .argument("<range>", "A1-style range, for example Sheet1!A1:B2")
    .option("--account <name>", "Optional saved connection name")
    .action(async (spreadsheetId: string, range: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: sheetsPlatformDefinition,
        actionId: "clear",
        spinnerText: "Clearing sheet values...",
        successMessage: "Sheet values cleared.",
        action: () => sheetsAdapter.clear({ account: input.account, spreadsheetId, range }),
      });
    });

  return command;
}

export const sheetsPlatformDefinition: PlatformDefinition = {
  id: "sheets",
  category: "google",
  displayName: "Google Sheets",
  description: "Create spreadsheets and read or write sheet ranges with OAuth2",
  authStrategies: ["oauth2"],
  buildCommand: buildSheetsCommand,
  adapter: sheetsAdapter,
  examples: EXAMPLES,
};
