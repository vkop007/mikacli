import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { currencyAdapter } from "./adapter.js";
import { currencyCapabilities } from "./capabilities/index.js";
import { printCurrencyResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";
import type { PlatformName } from "../../config.js";

const EXAMPLES = [
  "mikacli currency 100 USD INR",
  "mikacli forex 100 USD INR",
  "mikacli currency 100 USD EUR GBP",
  "mikacli currency 2500 INR USD",
] as const;

function buildCurrencyCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("currency").description("Convert currencies using a public no-key exchange-rate endpoint");
  command.argument("<amount>", "Amount to convert");
  command.argument("<from>", "Source currency code");
  command.argument("<to...>", "Target currency codes");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (amount: string, from: string, to: string[] | string, _options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading currency conversion...");

    await runCommandAction({
      spinner,
      successMessage: "Currency conversion loaded.",
      action: () =>
        currencyAdapter.currency({
          amount,
          from,
          to: Array.isArray(to) ? to.map(String) : [String(to ?? "")],
        }),
      onSuccess: (result) => printCurrencyResult(result, ctx.json),
    });
  });

  return command;
}

export const currencyPlatformDefinition: PlatformDefinition = {
  id: "currency" as PlatformName,
  category: "finance",
  displayName: "Currency",
  description: "Convert currencies and forex pairs from the terminal using a no-key public endpoint",
  aliases: ["forex"],
  authStrategies: ["none"],
  buildCommand: buildCurrencyCommand,
  adapter: currencyAdapter,
  capabilities: currencyCapabilities,
  examples: EXAMPLES,
};
