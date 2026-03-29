import type { Command } from "commander";

import { Logger } from "../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../utils/cli.js";
import { printJson } from "../../utils/output.js";
import type { AdapterActionResult } from "../../types.js";
import type { PlatformCapability } from "./platform-definition.js";
import { normalizeLoginActionResult } from "./login-result.js";

type CommandOption = {
  flags: string;
  description: string;
  required?: boolean;
  parser?: (value: string) => unknown;
};

type CapabilityActionContext = {
  args: unknown[];
  options: Record<string, unknown>;
};

type CapabilitySpec = {
  id: string;
  command: string;
  aliases?: readonly string[];
  description: string;
  spinnerText: string;
  successMessage: string;
  options?: readonly CommandOption[];
  action: (input: CapabilityActionContext) => Promise<AdapterActionResult>;
  onSuccess?: (result: AdapterActionResult, json: boolean) => void;
};

export function createAdapterActionCapability(spec: CapabilitySpec): PlatformCapability {
  return {
    id: spec.id,
    register(command: Command, definition) {
      const subcommand = command.command(spec.command).description(spec.description);

      for (const alias of spec.aliases ?? []) {
        subcommand.alias(alias);
      }

      for (const option of spec.options ?? []) {
        if (option.required) {
          if (option.parser) {
            subcommand.requiredOption(option.flags, option.description, option.parser);
          } else {
            subcommand.requiredOption(option.flags, option.description);
          }
        } else {
          if (option.parser) {
            subcommand.option(option.flags, option.description, option.parser);
          } else {
            subcommand.option(option.flags, option.description);
          }
        }
      }

      subcommand.action(async (...rawArgs: unknown[]) => {
        const cmd = rawArgs.at(-1) as Command;
        const options = (rawArgs.at(-2) ?? {}) as Record<string, unknown>;
        const args = rawArgs.slice(0, -2);
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner(spec.spinnerText);

        await runCommandAction({
          spinner,
          successMessage: spec.successMessage,
          action: () => spec.action({ args, options }),
          onSuccess: (result) => {
            const normalizedResult = spec.id === "login" ? normalizeLoginActionResult(result, definition) : result;
            if (spec.onSuccess) {
              spec.onSuccess(normalizedResult, ctx.json);
              return;
            }

            printActionResult(normalizedResult, ctx.json);
          },
        });
      });
    },
  };
}

export function printJsonResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
}
