import { Command } from "commander";

import { AutoCliError } from "../../../errors.js";
import { Logger } from "../../../logger.js";
import { setInteractiveProgressHandler } from "../../../utils/interactive-progress.js";
import { parsePositiveInteger } from "../../devops/shared/options.js";
import { printGoogleResult } from "./output.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export async function runGoogleAction(input: {
  cmd: Command;
  definition: PlatformDefinition;
  actionId: string;
  spinnerText: string;
  successMessage: string;
  action: () => Promise<AdapterActionResult>;
}): Promise<void> {
  const options = input.cmd.optsWithGlobals<{ json?: boolean; verbose?: boolean }>();
  const ctx = {
    json: Boolean(options.json),
    verbose: Boolean(options.verbose),
  };
  const logger = new Logger(ctx);
  const spinner = logger.spinner(input.spinnerText);
  try {
    if (spinner) {
      setInteractiveProgressHandler((message) => {
        spinner.text = message;
      });
    }

    const result = await input.action();
    const { normalizeActionResult } = await import("../../../core/runtime/login-result.js");
    const normalized = normalizeActionResult(result, input.definition, input.actionId);
    if (spinner) {
      spinner.succeed(input.successMessage);
    }
    printGoogleResult(normalized, ctx.json);
  } catch (error) {
    spinner?.stop();
    throw error;
  } finally {
    setInteractiveProgressHandler(null);
  }
}

export function parseGoogleScopes(value: string): string[] {
  return value
    .split(/[\s,]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseOptionalLimit(value: string): number {
  return parsePositiveInteger(value);
}

export function parseTimeoutSeconds(value: string): number {
  return parsePositiveInteger(value);
}

export function parseJsonTable(value: string): unknown[][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new AutoCliError("INVALID_JSON", `Invalid JSON passed to --values: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new AutoCliError("INVALID_JSON_ARRAY", "Expected --values to be a JSON array.");
  }

  return parsed.map((row) => (Array.isArray(row) ? row : [row]));
}
