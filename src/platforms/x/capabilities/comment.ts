import type { Command } from "commander";

import { Logger } from "../../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../../utils/cli.js";

import { xAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

export const xCommentCapability: PlatformCapability = {
  id: "comment",
  register(command: Command) {
    command
      .command("comment <target> <text>")
      .description("Reply to an X post by URL or tweet ID using the latest saved session by default")
      .option("--account <name>", "Optional override for a specific saved X session")
      .action(async (target, text, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Sending X reply...");
        await runCommandAction({
          spinner,
          successMessage: "X reply sent.",
          action: () =>
            xAdapter.comment({
              account: options.account,
              target,
              text,
            }),
          onSuccess: (result) => {
            printActionResult(result, ctx.json);
          },
        });
      });
  },
};
