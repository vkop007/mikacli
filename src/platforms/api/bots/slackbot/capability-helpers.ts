import type { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";
import { printJson } from "../../../../utils/output.js";

type CommandOption = {
  flags: string;
  description: string;
  required?: boolean;
  parser?: (value: string) => unknown;
};

type SlackbotCapabilityActionContext = {
  args: unknown[];
  options: Record<string, unknown>;
  command: Command;
};

export interface SlackbotCapability {
  id: string;
  register(command: Command): void;
}

export function createSlackbotCapability<T>(spec: {
  id: string;
  command: string;
  aliases?: readonly string[];
  description: string;
  spinnerText: string;
  successMessage: string;
  options?: readonly CommandOption[];
  configure?: (subcommand: Command) => void;
  action: (input: SlackbotCapabilityActionContext) => Promise<T>;
  onSuccess?: (result: T, json: boolean) => void;
}): SlackbotCapability {
  return {
    id: spec.id,
    register(command: Command) {
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
          continue;
        }

        if (option.parser) {
          subcommand.option(option.flags, option.description, option.parser);
        } else {
          subcommand.option(option.flags, option.description);
        }
      }

      spec.configure?.(subcommand);

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
          action: () => spec.action({ args, options, command: cmd }),
          onSuccess: (result) => {
            if (spec.onSuccess) {
              spec.onSuccess(result, ctx.json);
              return;
            }

            printJson(result);
          },
        });
      });
    },
  };
}

export function printSlackbotActionResult(result: unknown, json: boolean): void {
  printActionResult(result as any, json);
}
