import type { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";

import { xAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xLikeCapability: PlatformCapability = {
  id: "like",
  register(command: Command) {
    command
      .command("like <target>")
      .description("Like an X post by URL or tweet ID using the latest saved session by default")
      .option("--account <name>", "Optional override for a specific saved X session")
      .action(async (target, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Liking X post...");
        await runCommandAction({
          spinner,
          successMessage: "X post liked.",
          action: () =>
            xAdapter.like({
              account: options.account,
              target,
            }),
          onSuccess: (result) => {
            printActionResult(result, ctx.json);
          },
        });
      });
  },
};
