import { Command } from "commander";

import { runGoogleAction, parseGoogleScopes, parseOptionalLimit, parseTimeoutSeconds } from "../shared/command.js";
import { docsAdapter } from "./adapter.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli google docs login --client-id google-client-id-example --client-secret google-client-secret-example",
  "autocli google docs auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback",
  "autocli google docs documents --limit 10 --json",
  "autocli google docs document google-doc-id-example --json",
  "autocli google docs content google-doc-id-example --json",
  'autocli google docs create "Launch Notes" --text "Hello from AutoCLI" --json',
  'autocli google docs append-text google-doc-id-example "More text from AutoCLI" --json',
  'autocli google docs replace-text google-doc-id-example --search "draft" --replace "published" --json',
] as const;

function buildDocsCommand(_options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("docs").description("Use Google Docs through Google's OAuth2 APIs");

  command
    .command("auth-url")
    .description("Generate the Google OAuth consent URL for Docs")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--state <value>", "Optional OAuth state value")
    .option("--login-hint <email>", "Optional Google account email hint")
    .action(async (input: { clientId: string; redirectUri: string; scopes?: string[]; state?: string; loginHint?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "auth-url",
        spinnerText: "Generating Docs OAuth consent URL...",
        successMessage: "Docs OAuth consent URL generated.",
        action: () => docsAdapter.authUrl(input),
      });
    });

  command
    .command("login")
    .description("Save a Docs OAuth2 connection with localhost callback capture, an authorization code, or a refresh token")
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
        definition: docsPlatformDefinition,
        actionId: "login",
        spinnerText: "Saving Docs OAuth connection...",
        successMessage: "Docs OAuth connection saved.",
        action: () => docsAdapter.login({
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
    .description("Check the saved Docs OAuth connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "status",
        spinnerText: "Checking Docs connection...",
        successMessage: "Docs connection checked.",
        action: () => docsAdapter.statusAction(input.account),
      });
    });

  command
    .command("me")
    .description("Show the current Google profile behind the Docs connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "me",
        spinnerText: "Loading Docs profile...",
        successMessage: "Docs profile loaded.",
        action: () => docsAdapter.me(input.account),
      });
    });

  command
    .command("documents")
    .description("List Google Docs files")
    .option("--query <query>", "Optional Drive query fragment, for example name contains 'Launch'")
    .option("--limit <number>", "Maximum documents to return", parseOptionalLimit, 20)
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { query?: string; limit: number; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "documents",
        spinnerText: "Loading Google Docs files...",
        successMessage: "Google Docs files loaded.",
        action: () => docsAdapter.documents(input),
      });
    });

  command
    .command("document")
    .description("Load a single Google Doc")
    .argument("<document-id>", "Google Doc document id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (documentId: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "document",
        spinnerText: "Loading Google Doc...",
        successMessage: "Google Doc loaded.",
        action: () => docsAdapter.document({ account: input.account, documentId }),
      });
    });

  command
    .command("content")
    .description("Read plain text content from a Google Doc")
    .argument("<document-id>", "Google Doc document id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (documentId: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "content",
        spinnerText: "Loading Google Doc content...",
        successMessage: "Google Doc content loaded.",
        action: () => docsAdapter.content({ account: input.account, documentId }),
      });
    });

  command
    .command("create")
    .description("Create a new Google Doc")
    .argument("<title>", "Document title")
    .option("--text <value>", "Optional initial document text")
    .option("--account <name>", "Optional saved connection name")
    .action(async (title: string, input: { text?: string; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "create",
        spinnerText: "Creating Google Doc...",
        successMessage: "Google Doc created.",
        action: () => docsAdapter.create({ account: input.account, title, text: input.text }),
      });
    });

  command
    .command("append-text")
    .description("Append plain text to the end of a Google Doc")
    .argument("<document-id>", "Google Doc document id")
    .argument("<text...>", "Text to append")
    .option("--account <name>", "Optional saved connection name")
    .action(async (documentId: string, text: string[] | string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "append-text",
        spinnerText: "Appending text to Google Doc...",
        successMessage: "Text appended to Google Doc.",
        action: () =>
          docsAdapter.appendText({
            account: input.account,
            documentId,
            text: Array.isArray(text) ? text.join(" ") : text,
          }),
      });
    });

  command
    .command("replace-text")
    .description("Replace matching text throughout a Google Doc")
    .argument("<document-id>", "Google Doc document id")
    .requiredOption("--search <text>", "Text to search for")
    .requiredOption("--replace <text>", "Replacement text")
    .option("--match-case", "Match the search text case-sensitively")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      documentId: string,
      input: { search: string; replace: string; matchCase?: boolean; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: docsPlatformDefinition,
        actionId: "replace-text",
        spinnerText: "Replacing text in Google Doc...",
        successMessage: "Text replaced in Google Doc.",
        action: () =>
          docsAdapter.replaceText({
            account: input.account,
            documentId,
            search: input.search,
            replace: input.replace,
            matchCase: input.matchCase,
          }),
      });
    });

  return command;
}

export const docsPlatformDefinition: PlatformDefinition = {
  id: "docs",
  category: "google",
  displayName: "Google Docs",
  description: "List Google Docs files, read document content, create docs, and edit text with OAuth2",
  authStrategies: ["oauth2"],
  buildCommand: buildDocsCommand,
  adapter: docsAdapter,
  examples: EXAMPLES,
};
