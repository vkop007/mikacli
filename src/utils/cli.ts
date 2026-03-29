import type { Command } from "commander";
import type { Ora } from "ora";

import type { AdapterActionResult, CommandContext } from "../types.js";
import { printJson } from "./output.js";

export function resolveCommandContext(command: Command): CommandContext {
  const options = command.optsWithGlobals<{ json?: boolean; verbose?: boolean }>();
  return {
    json: Boolean(options.json),
    verbose: Boolean(options.verbose),
  };
}

export function printActionResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  console.log(result.message);

  if (result.user?.username) {
    console.log(`user: ${result.user.username}`);
  }

  if (result.id) {
    console.log(`id: ${result.id}`);
  }

  if (result.url) {
    console.log(`url: ${result.url}`);
  }

  if (result.sessionPath) {
    console.log(`session: ${result.sessionPath}`);
  }

  const login = readLoginMetadata(result);
  if (!login) {
    return;
  }

  console.log(`auth: ${formatAuthType(login.authType)}`);
  console.log(`validation: ${login.validation}`);

  if (login.source) {
    console.log(`source: ${formatLoginSource(login.source)}`);
  }

  if (login.reused) {
    console.log("reused: yes");
  }

  if (login.recommendedNextCommand) {
    console.log(`next: ${login.recommendedNextCommand}`);
  }
}

export async function runCommandAction<T>(input: {
  spinner: Ora | null;
  successMessage: string;
  action: () => Promise<T>;
  onSuccess: (result: T) => void;
}): Promise<void> {
  try {
    const result = await input.action();
    if (input.spinner) {
      const resultMessage = extractResultMessage(result);
      if (resultMessage && resultMessage === input.successMessage) {
        input.spinner.stop();
      } else {
        input.spinner.succeed(input.successMessage);
      }
    }
    input.onSuccess(result);
  } catch (error) {
    input.spinner?.stop();
    throw error;
  }
}

function extractResultMessage<T>(result: T): string | undefined {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return undefined;
  }

  const message = (result as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

function readLoginMetadata(result: AdapterActionResult): {
  authType: string;
  validation: string;
  source?: string;
  reused: boolean;
  recommendedNextCommand?: string;
} | null {
  if (result.action !== "login") {
    return null;
  }

  const value = result.data?.login;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const login = value as {
    authType?: unknown;
    validation?: unknown;
    source?: unknown;
    reused?: unknown;
    recommendedNextCommand?: unknown;
  };

  if (typeof login.authType !== "string" || typeof login.validation !== "string") {
    return null;
  }

  return {
    authType: login.authType,
    validation: login.validation,
    ...(typeof login.source === "string" && login.source.length > 0 ? { source: login.source } : {}),
    reused: Boolean(login.reused),
    ...(typeof login.recommendedNextCommand === "string" && login.recommendedNextCommand.length > 0
      ? { recommendedNextCommand: login.recommendedNextCommand }
      : {}),
  };
}

function formatAuthType(authType: string): string {
  switch (authType) {
    case "apiKey":
      return "api token";
    case "botToken":
      return "bot token";
    case "cookies":
      return "cookies";
    case "session":
      return "saved session";
    case "oauth2":
      return "oauth2";
    default:
      return authType;
  }
}

function formatLoginSource(source: string): string {
  switch (source) {
    case "cookie_string":
      return "cookie string";
    case "cookie_json":
      return "cookie json";
    case "cookies_txt":
      return "cookies.txt";
    case "bot_token":
      return "bot token";
    default:
      return source.replace(/_/gu, " ");
  }
}
