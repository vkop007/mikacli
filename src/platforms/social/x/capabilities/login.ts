import type { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";

import { xAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xLoginCapability: PlatformCapability = {
  id: "login",
  register(command: Command) {
    command
      .command("login")
      .description("Import cookies and save the X session for future headless use")
      .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
      .option("--account <name>", "Optional saved alias instead of the detected username")
      .option("--cookie-string <value>", "Raw cookie string instead of a file")
      .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
      .action(async (options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Importing X session...");
        await runCommandAction({
          spinner,
          successMessage: "X session imported.",
          action: () =>
            xAdapter.login({
              account: options.account,
              cookieFile: options.cookies,
              cookieString: options.cookieString,
              cookieJson: options.cookieJson,
            }),
          onSuccess: (result) => {
            printActionResult(result, ctx.json);
          },
        });
      });
  },
};
