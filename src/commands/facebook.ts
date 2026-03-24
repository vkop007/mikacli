import { Command } from "commander";

import { FacebookAdapter } from "../adapters/facebook.js";
import { Logger } from "../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../utils/cli.js";

const adapter = new FacebookAdapter();

export function createFacebookCommand(): Command {
  const command = new Command("facebook")
    .alias("fb")
    .description("Interact with Facebook using an imported browser session")
    .addHelpText(
      "afterAll",
      `
Examples:
  autocli facebook login --cookies ./facebook.cookies.json
  autocli facebook post "Launching from AutoCLI"
  autocli facebook like https://www.facebook.com/permalink.php?story_fbid=456&id=123
`,
    );

  command
    .command("login")
    .description("Import cookies and save the Facebook session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the detected Facebook user id")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing Facebook session...");
      await runCommandAction({
        spinner,
        successMessage: "Facebook session imported.",
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
    .description("Publish a Facebook post using the latest saved session by default")
    .option("--image <path>", "Optional image path for future Facebook post support")
    .option("--account <name>", "Optional override for a specific saved Facebook session")
    .action(async (text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Checking Facebook posting support...");
      await runCommandAction({
        spinner,
        successMessage: "Facebook post created.",
        action: () =>
          adapter.postText({
            account: options.account,
            text,
            imagePath: options.image,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("like <target>")
    .description("Like a Facebook post by URL or numeric object ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved Facebook session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking Facebook post...");
      await runCommandAction({
        spinner,
        successMessage: "Facebook post liked.",
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
    .description("Comment on a Facebook post by URL or numeric object ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved Facebook session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending Facebook comment...");
      await runCommandAction({
        spinner,
        successMessage: "Facebook comment sent.",
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
