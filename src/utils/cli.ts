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
}

export async function runCommandAction<T>(input: {
  spinner: Ora | null;
  successMessage: string;
  action: () => Promise<T>;
  onSuccess: (result: T) => void;
}): Promise<void> {
  try {
    const result = await input.action();
    input.spinner?.succeed(input.successMessage);
    input.onSuccess(result);
  } catch (error) {
    input.spinner?.stop();
    throw error;
  }
}
