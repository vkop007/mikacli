import { Command } from "commander";

import { runGoogleAction, parseGoogleScopes, parseOptionalLimit, parseTimeoutSeconds } from "../shared/command.js";
import { gmailAdapter } from "./adapter.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli google gmail login --client-id google-client-id-example --client-secret google-client-secret-example",
  "autocli google gmail auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback",
  "autocli google gmail login --client-id google-client-id-example --client-secret google-client-secret-example --code google-auth-code-example --redirect-uri http://127.0.0.1:3333/callback",
  "autocli google gmail labels --json",
  'autocli google gmail messages --query "label:inbox newer_than:7d" --limit 10 --json',
  "autocli google gmail message 197f1f0f1f0f1f0f --json",
  'autocli google gmail send person@example.com "Hello from AutoCLI" --subject "Checking in"',
] as const;

function buildGmailCommand(_options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("gmail").description("Use Gmail through Google's OAuth2 APIs");

  command
    .command("auth-url")
    .description("Generate the Google OAuth consent URL for Gmail")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--state <value>", "Optional OAuth state value")
    .option("--login-hint <email>", "Optional Google account email hint")
    .action(async (input: { clientId: string; redirectUri: string; scopes?: string[]; state?: string; loginHint?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: gmailPlatformDefinition,
        actionId: "auth-url",
        spinnerText: "Generating Gmail OAuth consent URL...",
        successMessage: "Gmail OAuth consent URL generated.",
        action: () => gmailAdapter.authUrl(input),
      });
    });

  command
    .command("login")
    .description("Save a Gmail OAuth2 connection with localhost callback capture, an authorization code, or a refresh token")
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
        definition: gmailPlatformDefinition,
        actionId: "login",
        spinnerText: "Saving Gmail OAuth connection...",
        successMessage: "Gmail OAuth connection saved.",
        action: () => gmailAdapter.login({
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
    .description("Check the saved Gmail OAuth connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: gmailPlatformDefinition,
        actionId: "status",
        spinnerText: "Checking Gmail connection...",
        successMessage: "Gmail connection checked.",
        action: () => gmailAdapter.statusAction(input.account),
      });
    });

  command
    .command("me")
    .description("Show the current Gmail account summary")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: gmailPlatformDefinition,
        actionId: "me",
        spinnerText: "Loading Gmail account summary...",
        successMessage: "Gmail account summary loaded.",
        action: () => gmailAdapter.me(input.account),
      });
    });

  command
    .command("labels")
    .description("List Gmail labels")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: gmailPlatformDefinition,
        actionId: "labels",
        spinnerText: "Loading Gmail labels...",
        successMessage: "Gmail labels loaded.",
        action: () => gmailAdapter.labels(input.account),
      });
    });

  command
    .command("messages")
    .description("List Gmail messages")
    .option("--account <name>", "Optional saved connection name")
    .option("--query <query>", "Gmail search query")
    .option("--limit <number>", "Maximum messages to return", parseOptionalLimit, 20)
    .action(async (input: { account?: string; query?: string; limit: number }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: gmailPlatformDefinition,
        actionId: "messages",
        spinnerText: "Loading Gmail messages...",
        successMessage: "Gmail messages loaded.",
        action: () => gmailAdapter.messages(input),
      });
    });

  command
    .command("message")
    .description("Load a single Gmail message")
    .argument("<id>", "Gmail message id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (id: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: gmailPlatformDefinition,
        actionId: "message",
        spinnerText: "Loading Gmail message...",
        successMessage: "Gmail message loaded.",
        action: () => gmailAdapter.message({ account: input.account, id }),
      });
    });

  command
    .command("send")
    .description("Send a Gmail message")
    .argument("<to>", "Recipient email")
    .argument("[text...]", "Plain-text email body")
    .requiredOption("--subject <text>", "Message subject")
    .option("--html <html>", "Optional HTML body")
    .option("--cc <email>", "Optional cc recipient")
    .option("--bcc <email>", "Optional bcc recipient")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      to: string,
      text: string[] | string,
      input: { subject: string; html?: string; cc?: string; bcc?: string; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: gmailPlatformDefinition,
        actionId: "send",
        spinnerText: "Sending Gmail message...",
        successMessage: "Gmail message sent.",
        action: () =>
          gmailAdapter.send({
            account: input.account,
            to,
            subject: input.subject,
            text: Array.isArray(text) ? text.join(" ") : text,
            html: input.html,
            cc: input.cc,
            bcc: input.bcc,
          }),
      });
    });

  return command;
}

export const gmailPlatformDefinition: PlatformDefinition = {
  id: "gmail",
  category: "google",
  displayName: "Gmail",
  description: "Read labels and messages, inspect message details, and send email through Gmail with OAuth2",
  authStrategies: ["oauth2"],
  buildCommand: buildGmailCommand,
  adapter: gmailAdapter,
  examples: EXAMPLES,
};
