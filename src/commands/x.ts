import { Command } from "commander";

import { XAdapter } from "../adapters/x.js";
import { Logger } from "../logger.js";
import { printActionResult, resolveCommandContext } from "../utils/cli.js";

const adapter = new XAdapter();

export function createXCommand(): Command {
  const command = new Command("x")
    .alias("twitter")
    .description("Interact with X/Twitter using an imported browser session");

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
      const result = await adapter.login({
        account: options.account,
        cookieFile: options.cookies,
        cookieString: options.cookieString,
        cookieJson: options.cookieJson,
      });
      spinner?.succeed("X session imported.");
      printActionResult(result, ctx.json);
    });

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
      const result = await adapter.postText({
        account: options.account,
        text,
        imagePath: options.image,
      });
      spinner?.succeed("X post created.");
      printActionResult(result, ctx.json);
    });

  postCommand.alias("publish");

  command
    .command("like <target>")
    .description("Like an X post by URL or tweet ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking X post...");
      const result = await adapter.like({
        account: options.account,
        target,
      });
      spinner?.succeed("X post liked.");
      printActionResult(result, ctx.json);
    });

  command
    .command("comment <target> <text>")
    .description("Reply to an X post by URL or tweet ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending X reply...");
      const result = await adapter.comment({
        account: options.account,
        target,
        text,
      });
      spinner?.succeed("X reply sent.");
      printActionResult(result, ctx.json);
    });

  return command;
}
