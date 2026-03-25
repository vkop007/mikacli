import type { Command } from "commander";

import { Logger } from "../../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";

import { xAdapter } from "../adapter.js";
import { printXProfileResult } from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xProfileIdCapability: PlatformCapability = {
  id: "profileid",
  register(command: Command) {
    command
      .command("profileid <target>")
      .alias("profile")
      .description("Load exact X profile details by URL, @handle, handle, or numeric user ID")
      .option("--account <name>", "Optional override for a specific saved X session")
      .action(async (target, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Loading X profile details...");
        await runCommandAction({
          spinner,
          successMessage: "X profile details loaded.",
          action: () =>
            xAdapter.profileInfo({
              account: options.account,
              target,
            }),
          onSuccess: (result) => {
            printXProfileResult(result, ctx.json);
          },
        });
      });
  },
};
