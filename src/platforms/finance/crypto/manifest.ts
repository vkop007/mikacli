import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { cryptoAdapter } from "./adapter.js";
import { cryptoCapabilities } from "./capabilities/index.js";
import { printCryptoResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = ["mikacli crypto bitcoin", "mikacli crypto btc --vs usd", "mikacli crypto ethereum --vs inr"] as const;

function buildCryptoCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("crypto").description("Load crypto prices from a public no-key market feed");
  command.argument("<asset>", "Crypto asset id, symbol, or name");
  command.option("--vs <currency>", "Quote currency such as usd, inr, eur (default: usd)", "usd");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (asset: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading crypto price...");

    await runCommandAction({
      spinner,
      successMessage: "Crypto price loaded.",
      action: () =>
        cryptoAdapter.price({
          asset,
          vs: options.vs as string | undefined,
        }),
      onSuccess: (result) => printCryptoResult(result, ctx.json),
    });
  });

  return command;
}

export const cryptoPlatformDefinition: PlatformDefinition = {
  id: "crypto" as PlatformDefinition["id"],
  category: "finance",
  displayName: "Crypto",
  description: "Load crypto prices from CoinGecko without any account setup",
  authStrategies: ["none"],
  buildCommand: buildCryptoCommand,
  adapter: cryptoAdapter,
  capabilities: cryptoCapabilities,
  examples: EXAMPLES,
};
