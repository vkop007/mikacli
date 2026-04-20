import type { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";
import { parseBrowserTimeoutSeconds } from "../../../shared/cookie-login.js";

import { xAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xCommentCapability: PlatformCapability = {
  id: "comment",
  register(command: Command) {
    command
      .command("comment <target> <text>")
      .description("Reply to an X post by URL or tweet ID through a browser-backed reply flow")
      .option("--account <name>", "Optional override for a specific saved X session")
      .option("--browser", "Force the reply through the shared MikaCLI browser profile instead of the invisible browser-backed path")
      .option("--browser-timeout <seconds>", "Maximum seconds to allow the browser action to complete", parseBrowserTimeoutSeconds)
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
              browser: Boolean(options.browser),
              browserTimeoutSeconds: options.browserTimeout as number | undefined,
            }),
          onSuccess: (result) => {
            printActionResult(result, ctx.json);
          },
        });
      });
  },
};
