import type { Command } from "commander";

import { Logger } from "../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../utils/cli.js";
import { printJson } from "../../utils/output.js";
import type { AdapterActionResult, AdapterStatusResult } from "../../types.js";
import type { PlatformCapability } from "./platform-definition.js";
import { normalizeActionResult } from "./login-result.js";

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

type StatusCapableAdapter = {
  displayName: string;
  getStatus(account?: string): Promise<AdapterStatusResult>;
};

type StatusCapabilitySpec = {
  adapter: StatusCapableAdapter;
  subject?: string;
  accountOption?: {
    key: string;
    flags: string;
    description: string;
  };
  description?: string;
  spinnerText?: string;
  successMessage?: string;
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
            const normalizedResult = normalizeActionResult(result, definition, spec.id);
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

export function statusResultToActionResult(displayName: string, result: AdapterStatusResult, subject = "connection"): AdapterActionResult {
  return {
    ok: true,
    platform: result.platform,
    account: result.account,
    action: "status",
    message: `${displayName} ${subject} is ${result.status}.`,
    user: result.user,
    sessionPath: result.sessionPath,
    data: {
      connected: result.connected,
      status: result.status,
      details: result.message,
      lastValidatedAt: result.lastValidatedAt,
    },
  };
}

export function createAdapterStatusCapability(spec: StatusCapabilitySpec): PlatformCapability {
  const subject = spec.subject ?? "connection";
  const accountOption = spec.accountOption ?? {
    key: "account",
    flags: "--account <name>",
    description: `Optional saved ${spec.adapter.displayName} ${subject} name to inspect`,
  };

  return createAdapterActionCapability({
    id: "status",
    command: "status",
    description: spec.description ?? `Show the saved ${spec.adapter.displayName} ${subject} status`,
    spinnerText: spec.spinnerText ?? `Checking ${spec.adapter.displayName} ${subject}...`,
    successMessage: spec.successMessage ?? `${spec.adapter.displayName} ${subject} checked.`,
    options: [{ flags: accountOption.flags, description: accountOption.description }],
    action: async ({ options }) =>
      statusResultToActionResult(
        spec.adapter.displayName,
        await spec.adapter.getStatus(options[accountOption.key] as string | undefined),
        subject,
      ),
    onSuccess: spec.onSuccess,
  });
}

export function printJsonResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
}
