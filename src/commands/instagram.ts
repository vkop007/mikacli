import { Command } from "commander";

import { InstagramAdapter } from "../adapters/instagram.js";
import { Logger } from "../logger.js";
import { printActionResult, resolveCommandContext } from "../utils/cli.js";

const adapter = new InstagramAdapter();

export function createInstagramCommand(): Command {
  const command = new Command("instagram")
    .alias("ig")
    .description("Interact with Instagram using an imported browser session");

  command
    .command("login")
    .description("Import cookies and save the Instagram session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the detected username")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing Instagram session...");
      const result = await adapter.login({
        account: options.account,
        cookieFile: options.cookies,
        cookieString: options.cookieString,
        cookieJson: options.cookieJson,
      });
      spinner?.succeed("Instagram session imported.");
      printActionResult(result, ctx.json);
    });

  command
    .command("post <mediaPath>")
    .description("Publish an Instagram post with media and an optional caption using the latest saved session by default")
    .requiredOption("--caption <text>", "Caption for the post")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (mediaPath, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating Instagram post...");
      const result = await adapter.postMedia({
        account: options.account,
        mediaPath,
        caption: options.caption,
      });
      spinner?.succeed("Instagram post created.");
      printActionResult(result, ctx.json);
    });

  command
    .command("like <target>")
    .description("Like an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking Instagram post...");
      const result = await adapter.like({
        account: options.account,
        target,
      });
      spinner?.succeed("Instagram post liked.");
      printActionResult(result, ctx.json);
    });

  command
    .command("comment <target> <text>")
    .description("Comment on an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved Instagram session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending Instagram comment...");
      const result = await adapter.comment({
        account: options.account,
        target,
        text,
      });
      spinner?.succeed("Instagram comment sent.");
      printActionResult(result, ctx.json);
    });

  return command;
}
