import { Command } from "commander";

import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { stocksAdapter } from "./adapter.js";
import { stocksCapabilities } from "./capabilities/index.js";
import { printStocksResult } from "./output.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

function buildStocksCommand(): Command {
  const command = new Command("stocks").description("Load stock quotes from a public no-key market feed");
  command.argument("<symbol>", "Stock ticker symbol, such as AAPL or TSLA");
  command.option("--market <code>", "Market suffix for symbols without an exchange suffix (default: us)", "us");
  command.addHelpText(
    "afterAll",
    `
Examples:
  autocli stocks AAPL
  autocli stocks TSLA
  autocli stocks RYCEY --market l
`,
  );

  command.action(async (symbol: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading stock quote...");

    await runCommandAction({
      spinner,
      successMessage: "Stock quote loaded.",
      action: () =>
        stocksAdapter.quote({
          symbol,
          market: options.market as string | undefined,
        }),
      onSuccess: (result) => printStocksResult(result, ctx.json),
    });
  });

  return command;
}

export const stocksPlatformDefinition: PlatformDefinition = {
  id: "stocks" as PlatformDefinition["id"],
  category: "public",
  displayName: "Stocks",
  description: "Load stock quotes from the public Stooq endpoint without any account setup",
  authStrategies: ["none"],
  buildCommand: buildStocksCommand,
  adapter: stocksAdapter,
  capabilities: stocksCapabilities,
  examples: ["autocli stocks AAPL", "autocli stocks TSLA"],
};
