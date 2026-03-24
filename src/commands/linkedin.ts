import { Command } from "commander";

import { LinkedInAdapter } from "../adapters/linkedin.js";
import { Logger } from "../logger.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../utils/cli.js";

const adapter = new LinkedInAdapter();

export function createLinkedInCommand(): Command {
  const command = new Command("linkedin")
    .alias("li")
    .description("Interact with LinkedIn using an imported browser session")
    .addHelpText(
      "afterAll",
      `
Examples:
  autocli linkedin login --cookies ./linkedin.cookies.json
  autocli linkedin post "Posting from AutoCLI"
  autocli linkedin like https://www.linkedin.com/feed/update/urn:li:activity:1234567890123456789/
`,
    );

  command
    .command("login")
    .description("Import cookies and save the LinkedIn session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the detected LinkedIn handle")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing LinkedIn session...");
      await runCommandAction({
        spinner,
        successMessage: "LinkedIn session imported.",
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
    .alias("share")
    .description("Publish a text post on LinkedIn using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved LinkedIn session")
    .action(async (text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating LinkedIn post...");
      await runCommandAction({
        spinner,
        successMessage: "LinkedIn post created.",
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
    .description("Like a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved LinkedIn session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking LinkedIn post...");
      await runCommandAction({
        spinner,
        successMessage: "LinkedIn post liked.",
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
    .description("Comment on a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved LinkedIn session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending LinkedIn comment...");
      await runCommandAction({
        spinner,
        successMessage: "LinkedIn comment sent.",
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
