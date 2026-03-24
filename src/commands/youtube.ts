import { Command } from "commander";

import { YouTubeAdapter } from "../adapters/youtube.js";
import { Logger } from "../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../utils/cli.js";

const adapter = new YouTubeAdapter();

export function createYouTubeCommand(): Command {
  const command = new Command("youtube")
    .alias("yt")
    .description("Interact with YouTube using an imported browser session");

  command
    .command("login")
    .description("Import cookies and save the YouTube session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the default session name")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing YouTube session...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube session imported.",
        action: () =>
          adapter.login({
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

  command
    .command("post <text>")
    .description("YouTube text posting is not implemented in this CLI")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Checking YouTube posting support...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube action completed.",
        action: () =>
          adapter.postText({
            account: options.account,
            text,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("like <target>")
    .description("Like a YouTube video by URL or 11-character video ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking YouTube video...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube video liked.",
        action: () =>
          adapter.like({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("comment <target> <text>")
    .description("Comment on a YouTube video by URL or 11-character video ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved YouTube session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending YouTube comment...");
      await runCommandAction({
        spinner,
        successMessage: "YouTube comment sent.",
        action: () =>
          adapter.comment({
            account: options.account,
            target,
            text,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  return command;
}
