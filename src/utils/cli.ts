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
