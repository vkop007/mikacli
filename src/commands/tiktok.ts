import { Command } from "commander";

import { TikTokAdapter } from "../adapters/tiktok.js";
import { Logger } from "../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../utils/cli.js";

const adapter = new TikTokAdapter();

export function createTikTokCommand(): Command {
  const command = new Command("tiktok")
    .alias("tt")
    .description("Interact with TikTok using an imported browser session")
    .addHelpText(
      "afterAll",
      `
Examples:
  autocli tiktok login --cookies ./tiktok.cookies.json
  autocli tiktok post ./clip.mp4 --caption "Posting from AutoCLI"
  autocli tiktok like https://www.tiktok.com/@user/video/7486727777941556488
`,
    );

  command
    .command("login")
    .description("Import cookies and save the TikTok session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the detected TikTok handle")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing TikTok session...");
      await runCommandAction({
        spinner,
        successMessage: "TikTok session imported.",
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
    .command("post <mediaPath>")
    .description("Publish a TikTok video using the latest saved session by default")
    .option("--caption <text>", "Optional caption for the TikTok post")
    .option("--account <name>", "Optional override for a specific saved TikTok session")
    .action(async (mediaPath, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Checking TikTok posting support...");
      await runCommandAction({
        spinner,
        successMessage: "TikTok post created.",
        action: () =>
          adapter.postMedia({
            account: options.account,
            mediaPath,
            caption: options.caption,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("like <target>")
    .description("Like a TikTok video by URL or numeric item ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved TikTok session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking TikTok post...");
      await runCommandAction({
        spinner,
        successMessage: "TikTok post liked.",
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
    .description("Comment on a TikTok video by URL or numeric item ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved TikTok session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending TikTok comment...");
      await runCommandAction({
        spinner,
        successMessage: "TikTok comment sent.",
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
