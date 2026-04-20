import { Command } from "commander";

import { runGoogleAction, parseGoogleScopes, parseOptionalLimit, parseTimeoutSeconds } from "../shared/command.js";
import { formsAdapter } from "./adapter.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli google forms login --client-id google-client-id-example --client-secret google-client-secret-example",
  "mikacli google forms auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback",
  "mikacli google forms forms --limit 10 --json",
  "mikacli google forms form google-form-id-example --json",
  'mikacli google forms create "Launch Survey" --description "Tell us what you think" --json',
  'mikacli google forms add-text-question google-form-id-example --title "What should we improve?" --paragraph --required --json',
  'mikacli google forms add-choice-question google-form-id-example --title "How did we do?" --options "Great|Good|Okay|Needs work" --type RADIO --json',
  "mikacli google forms responses google-form-id-example --limit 20 --json",
] as const;

function buildFormsCommand(_options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("forms").description("Use Google Forms through Google's OAuth2 APIs");

  command
    .command("auth-url")
    .description("Generate the Google OAuth consent URL for Forms")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--state <value>", "Optional OAuth state value")
    .option("--login-hint <email>", "Optional Google account email hint")
    .action(async (input: { clientId: string; redirectUri: string; scopes?: string[]; state?: string; loginHint?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "auth-url",
        spinnerText: "Generating Forms OAuth consent URL...",
        successMessage: "Forms OAuth consent URL generated.",
        action: () => formsAdapter.authUrl(input),
      });
    });

  command
    .command("login")
    .description("Save a Forms OAuth2 connection with localhost callback capture, an authorization code, or a refresh token")
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
        definition: formsPlatformDefinition,
        actionId: "login",
        spinnerText: "Saving Forms OAuth connection...",
        successMessage: "Forms OAuth connection saved.",
        action: () => formsAdapter.login({
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
    .description("Check the saved Forms OAuth connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "status",
        spinnerText: "Checking Forms connection...",
        successMessage: "Forms connection checked.",
        action: () => formsAdapter.statusAction(input.account),
      });
    });

  command
    .command("me")
    .description("Show the current Google profile behind the Forms connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "me",
        spinnerText: "Loading Forms profile...",
        successMessage: "Forms profile loaded.",
        action: () => formsAdapter.me(input.account),
      });
    });

  command
    .command("forms")
    .description("List Google Forms files")
    .option("--query <query>", "Optional Drive query fragment, for example name contains 'Survey'")
    .option("--limit <number>", "Maximum forms to return", parseOptionalLimit, 20)
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { query?: string; limit: number; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "forms",
        spinnerText: "Loading Google Forms files...",
        successMessage: "Google Forms files loaded.",
        action: () => formsAdapter.forms(input),
      });
    });

  command
    .command("form")
    .description("Load a single Google Form")
    .argument("<form-id>", "Google Form id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (formId: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "form",
        spinnerText: "Loading Google Form...",
        successMessage: "Google Form loaded.",
        action: () => formsAdapter.form({ account: input.account, formId }),
      });
    });

  command
    .command("responses")
    .description("List responses for a Google Form")
    .argument("<form-id>", "Google Form id")
    .option("--filter <value>", "Optional Google Forms response filter")
    .option("--limit <number>", "Maximum responses to return", parseOptionalLimit, 20)
    .option("--account <name>", "Optional saved connection name")
    .action(async (formId: string, input: { filter?: string; limit: number; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "responses",
        spinnerText: "Loading Google Form responses...",
        successMessage: "Google Form responses loaded.",
        action: () => formsAdapter.responses({
          account: input.account,
          formId,
          filter: input.filter,
          limit: input.limit,
        }),
      });
    });

  command
    .command("response")
    .description("Load a single Google Form response")
    .argument("<form-id>", "Google Form id")
    .argument("<response-id>", "Google Form response id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (formId: string, responseId: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "response",
        spinnerText: "Loading Google Form response...",
        successMessage: "Google Form response loaded.",
        action: () => formsAdapter.response({ account: input.account, formId, responseId }),
      });
    });

  command
    .command("create")
    .description("Create a new Google Form")
    .argument("<title>", "Form title")
    .option("--description <text>", "Optional form description")
    .option("--document-title <text>", "Optional Drive document title")
    .option("--unpublished", "Create the form in an unpublished state when supported")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      title: string,
      input: { description?: string; documentTitle?: string; unpublished?: boolean; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "create",
        spinnerText: "Creating Google Form...",
        successMessage: "Google Form created.",
        action: () =>
          formsAdapter.create({
            account: input.account,
            title,
            description: input.description,
            documentTitle: input.documentTitle,
            unpublished: input.unpublished,
          }),
      });
    });

  command
    .command("update-info")
    .description("Update the title or description of a Google Form")
    .argument("<form-id>", "Google Form id")
    .option("--title <text>", "Updated form title")
    .option("--description <text>", "Updated form description")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      formId: string,
      input: { title?: string; description?: string; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "update-info",
        spinnerText: "Updating Google Form info...",
        successMessage: "Google Form info updated.",
        action: () =>
          formsAdapter.updateInfo({
            account: input.account,
            formId,
            title: input.title,
            description: input.description,
          }),
      });
    });

  command
    .command("add-text-question")
    .description("Add a short-text or paragraph question to a Google Form")
    .argument("<form-id>", "Google Form id")
    .requiredOption("--title <text>", "Question title")
    .option("--description <text>", "Optional question description")
    .option("--required", "Require a response before submit")
    .option("--index <number>", "Optional item index to insert at", parseNonNegativeInteger)
    .option("--paragraph", "Create a paragraph question instead of a short-text question")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      formId: string,
      input: { title: string; description?: string; required?: boolean; index?: number; paragraph?: boolean; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "add-text-question",
        spinnerText: "Adding text question to Google Form...",
        successMessage: "Text question added to Google Form.",
        action: () =>
          formsAdapter.addTextQuestion({
            account: input.account,
            formId,
            title: input.title,
            description: input.description,
            required: input.required,
            index: input.index,
            paragraph: input.paragraph,
          }),
      });
    });

  command
    .command("add-choice-question")
    .description("Add a radio, checkbox, or drop-down question to a Google Form")
    .argument("<form-id>", "Google Form id")
    .requiredOption("--title <text>", "Question title")
    .requiredOption("--options <values>", "Choice options separated by | or ,", parseChoiceOptions)
    .option("--description <text>", "Optional question description")
    .option("--required", "Require a response before submit")
    .option("--index <number>", "Optional item index to insert at", parseNonNegativeInteger)
    .option("--type <kind>", "Question type: RADIO, CHECKBOX, or DROP_DOWN", "RADIO")
    .option("--shuffle", "Shuffle answer options")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      formId: string,
      input: {
        title: string;
        options: string[];
        description?: string;
        required?: boolean;
        index?: number;
        type?: string;
        shuffle?: boolean;
        account?: string;
      },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "add-choice-question",
        spinnerText: "Adding choice question to Google Form...",
        successMessage: "Choice question added to Google Form.",
        action: () =>
          formsAdapter.addChoiceQuestion({
            account: input.account,
            formId,
            title: input.title,
            options: input.options,
            description: input.description,
            required: input.required,
            index: input.index,
            type: input.type,
            shuffle: input.shuffle,
          }),
      });
    });

  command
    .command("delete-item")
    .description("Delete an item from a Google Form by index")
    .argument("<form-id>", "Google Form id")
    .requiredOption("--index <number>", "Item index to delete", parseNonNegativeInteger)
    .option("--account <name>", "Optional saved connection name")
    .action(async (formId: string, input: { index: number; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "delete-item",
        spinnerText: "Deleting Google Form item...",
        successMessage: "Google Form item deleted.",
        action: () =>
          formsAdapter.deleteItem({
            account: input.account,
            formId,
            index: input.index,
          }),
      });
    });

  command
    .command("publish")
    .description("Publish or unpublish a Google Form and control whether it accepts responses")
    .argument("<form-id>", "Google Form id")
    .requiredOption("--published <value>", "Whether the form should be published", parseBoolean)
    .option("--accepting-responses <value>", "Whether the form should accept responses", parseBoolean)
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      formId: string,
      input: { published: boolean; acceptingResponses?: boolean; account?: string },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "publish",
        spinnerText: "Updating Google Form publish settings...",
        successMessage: "Google Form publish settings updated.",
        action: () =>
          formsAdapter.publish({
            account: input.account,
            formId,
            published: input.published,
            acceptingResponses: input.acceptingResponses,
          }),
      });
    });

  command
    .command("delete")
    .description("Delete a Google Form from Drive")
    .argument("<form-id>", "Google Form id")
    .option("--account <name>", "Optional saved connection name")
    .action(async (formId: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: formsPlatformDefinition,
        actionId: "delete",
        spinnerText: "Deleting Google Form...",
        successMessage: "Google Form deleted.",
        action: () => formsAdapter.delete({ account: input.account, formId }),
      });
    });

  return command;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Expected a non-negative integer.");
  }

  return parsed;
}

function parseChoiceOptions(value: string): string[] {
  return value
    .split(/\s*(?:\||,)\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  throw new Error("Expected a boolean value like true or false.");
}

export const formsPlatformDefinition: PlatformDefinition = {
  id: "forms",
  category: "google",
  displayName: "Google Forms",
  description: "List forms, inspect responses, create surveys, add questions, and manage publish state with OAuth2",
  authStrategies: ["oauth2"],
  buildCommand: buildFormsCommand,
  adapter: formsAdapter,
  examples: EXAMPLES,
};
