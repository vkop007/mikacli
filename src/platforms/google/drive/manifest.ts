import { Command } from "commander";

import { runGoogleAction, parseGoogleScopes, parseOptionalLimit, parseTimeoutSeconds } from "../shared/command.js";
import { driveAdapter } from "./adapter.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli google drive login --client-id google-client-id-example --client-secret google-client-secret-example",
  "mikacli google drive auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback",
  "mikacli google drive login --client-id google-client-id-example --client-secret google-client-secret-example --refresh-token google-refresh-token-example",
  "mikacli google drive files --limit 10 --json",
  "mikacli google drive files --query \"mimeType != 'application/vnd.google-apps.folder'\" --json",
  "mikacli google drive create-folder Reports --json",
  "mikacli google drive upload ./report.pdf --parent google-folder-id-example --json",
  "mikacli google drive download google-file-id-example --output ./downloads/report.pdf --json",
] as const;

function buildDriveCommand(_options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("drive").description("Use Google Drive through Google's OAuth2 APIs");

  command
    .command("auth-url")
    .description("Generate the Google OAuth consent URL for Drive")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--state <value>", "Optional OAuth state value")
    .option("--login-hint <email>", "Optional Google account email hint")
    .action(async (input: { clientId: string; redirectUri: string; scopes?: string[]; state?: string; loginHint?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "auth-url",
        spinnerText: "Generating Drive OAuth consent URL...",
        successMessage: "Drive OAuth consent URL generated.",
        action: () => driveAdapter.authUrl(input),
      });
    });

  command
    .command("login")
    .description("Save a Drive OAuth2 connection with localhost callback capture, an authorization code, or a refresh token")
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
        definition: drivePlatformDefinition,
        actionId: "login",
        spinnerText: "Saving Drive OAuth connection...",
        successMessage: "Drive OAuth connection saved.",
        action: () => driveAdapter.login({
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
    .description("Check the saved Drive OAuth connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "status",
        spinnerText: "Checking Drive connection...",
        successMessage: "Drive connection checked.",
        action: () => driveAdapter.statusAction(input.account),
      });
    });

  command
    .command("me")
    .description("Show the current Drive account summary")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "me",
        spinnerText: "Loading Drive account summary...",
        successMessage: "Drive account summary loaded.",
        action: () => driveAdapter.me(input.account),
      });
    });

  command
    .command("files")
    .description("List Google Drive files")
    .option("--account <name>", "Optional saved connection name")
    .option("--query <query>", "Drive query string")
    .option("--limit <number>", "Maximum files to return", parseOptionalLimit, 20)
    .action(async (input: { account?: string; query?: string; limit: number }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "files",
        spinnerText: "Loading Drive files...",
        successMessage: "Drive files loaded.",
        action: () => driveAdapter.files(input),
      });
    });

  command
    .command("file")
    .description("Load a single Google Drive file")
    .argument("<id>", "Drive file id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (id: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "file",
        spinnerText: "Loading Drive file...",
        successMessage: "Drive file loaded.",
        action: () => driveAdapter.file({ account: input.account, id }),
      });
    });

  command
    .command("create-folder")
    .description("Create a Google Drive folder")
    .argument("<name>", "Folder name")
    .option("--parent <id>", "Optional parent folder id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (name: string, input: { parent?: string; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "create-folder",
        spinnerText: "Creating Drive folder...",
        successMessage: "Drive folder created.",
        action: () => driveAdapter.createFolder({ account: input.account, name, parentId: input.parent }),
      });
    });

  command
    .command("upload")
    .description("Upload a local file to Google Drive")
    .argument("<path>", "Local file path")
    .option("--name <name>", "Optional Drive file name override")
    .option("--parent <id>", "Optional parent folder id")
    .option("--mime-type <type>", "Optional MIME type override")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      filePath: string,
      input: { name?: string; parent?: string; mimeType?: string; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "upload",
        spinnerText: "Uploading to Drive...",
        successMessage: "Drive upload completed.",
        action: () =>
          driveAdapter.upload({
            account: input.account,
            filePath,
            name: input.name,
            parentId: input.parent,
            mimeType: input.mimeType,
          }),
      });
    });

  command
    .command("download")
    .description("Download a Google Drive file to a local path")
    .argument("<id>", "Drive file id")
    .requiredOption("--output <path>", "Local output path")
    .option("--account <name>", "Optional saved connection name")
    .action(async (id: string, input: { output: string; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "download",
        spinnerText: "Downloading from Drive...",
        successMessage: "Drive download completed.",
        action: () => driveAdapter.download({ account: input.account, id, outputPath: input.output }),
      });
    });

  command
    .command("delete")
    .description("Delete a Google Drive file")
    .argument("<id>", "Drive file id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (id: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: drivePlatformDefinition,
        actionId: "delete",
        spinnerText: "Deleting Drive file...",
        successMessage: "Drive file deleted.",
        action: () => driveAdapter.delete({ account: input.account, id }),
      });
    });

  return command;
}

export const drivePlatformDefinition: PlatformDefinition = {
  id: "drive",
  category: "google",
  displayName: "Google Drive",
  description: "List, inspect, upload, download, create folders, and delete Drive files with OAuth2",
  authStrategies: ["oauth2"],
  buildCommand: buildDriveCommand,
  adapter: driveAdapter,
  examples: EXAMPLES,
};
