import type { Command } from "commander";

import { Logger } from "../../../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../../utils/cli.js";

import { xAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

export const xPostCapability: PlatformCapability = {
  id: "post",
  register(command: Command) {
    const postCommand = command
      .command("post <text>")
      .alias("tweet")
      .description("Publish a text post on X, optionally with one image, using the latest saved session by default")
      .option("--image <path>", "Attach an image to the post")
      .option("--account <name>", "Optional override for a specific saved X session")
      .action(async (text, options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Creating X post...");
        await runCommandAction({
          spinner,
          successMessage: "X post created.",
          action: () =>
            xAdapter.postText({
              account: options.account,
              text,
              imagePath: options.image,
            }),
          onSuccess: (result) => {
            printActionResult(result, ctx.json);
          },
        });
      });

    postCommand.alias("publish");
  },
};
