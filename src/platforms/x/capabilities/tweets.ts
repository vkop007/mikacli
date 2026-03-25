import type { Command } from "commander";

import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";

import { xAdapter } from "../adapter.js";
import { parseLimitOption } from "../options.js";
import { printXTweetListResult } from "../output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

export const xTweetsCapability: PlatformCapability = {
  id: "tweets",
  register(command: Command) {
    command
      .command("tweets <target>")
      .description("List recent X posts for a profile URL, @handle, handle, or numeric user ID")
      .option("--limit <number>", "Maximum number of posts to return (1-25, default: 5)", parseLimitOption)
      .option("--account <name>", "Optional override for a specific saved X session")
      .action(async (target, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Loading X posts...");
        await runCommandAction({
          spinner,
          successMessage: "X posts loaded.",
          action: () =>
            xAdapter.tweets({
              account: options.account,
              target,
              limit: options.limit,
            }),
          onSuccess: (result) => {
            printXTweetListResult(result, ctx.json, "tweets");
          },
        });
      });
  },
};
