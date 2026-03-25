import type { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";

import { xAdapter } from "../adapter.js";
import { parseLimitOption } from "../options.js";
import { printXUserResultList } from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xSearchCapability: PlatformCapability = {
  id: "search",
  register(command: Command) {
    command
      .command("search <query>")
      .description("Search X accounts")
      .option("--limit <number>", "Maximum number of results to return (1-25, default: 5)", parseLimitOption)
      .option("--account <name>", "Optional override for a specific saved X session")
      .action(async (query, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Searching X...");
        await runCommandAction({
          spinner,
          successMessage: "X search completed.",
          action: () =>
            xAdapter.search({
              account: options.account,
              query,
              limit: options.limit,
            }),
          onSuccess: (result) => {
            printXUserResultList(result, ctx.json);
          },
        });
      });
  },
};
