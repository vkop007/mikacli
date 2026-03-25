import type { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";

import { xAdapter } from "../adapter.js";
import { printXTweetResult } from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xTweetIdCapability: PlatformCapability = {
  id: "tweetid",
  register(command: Command) {
    command
      .command("tweetid <target>")
      .alias("info")
      .description("Load exact X post details by URL or tweet ID")
      .option("--account <name>", "Optional override for a specific saved X session")
      .action(async (target, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Loading X post details...");
        await runCommandAction({
          spinner,
          successMessage: "X post details loaded.",
          action: () =>
            xAdapter.tweetInfo({
              account: options.account,
              target,
            }),
          onSuccess: (result) => {
            printXTweetResult(result, ctx.json);
          },
        });
      });
  },
};
