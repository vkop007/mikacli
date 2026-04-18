import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { AutoCliError } from "../../../errors.js";
import { printTempMailResult } from "./output.js";
import { tempMailAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli tools tempmail domains",
  "autocli tools tempmail create",
  "autocli tools tempmail create --name signup-check",
  "autocli tools tempmail login --address signup-check@example.com --password secret-value",
  "autocli tools tempmail inbox --limit 10",
  "autocli tools tempmail wait --timeout 90",
  "autocli tools tempmail message message-id-example",
  "autocli tools tempmail delete-inbox",
] as const;

function buildTempMailCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("tempmail").description("Create a free disposable inbox, read messages, and wait for verification emails");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("domains")
    .description("List currently available free temp-mail domains from Mail.tm")
    .action(async (_input: Record<string, unknown>, cmd: Command) => {
      await runTempMailAction(cmd, "Loading temp-mail domains...", "Temp-mail domains loaded.", () => tempMailAdapter.domains());
    });

  command
    .command("create")
    .description("Create and save a new disposable mailbox")
    .option("--account <name>", "Optional saved mailbox name")
    .option("--name <local-part>", "Optional email local part, for example signup-check")
    .option("--domain <domain>", "Optional preferred domain from `autocli tools tempmail domains`")
    .option("--password <text>", "Optional mailbox password; defaults to a generated random value")
    .action(async (
      input: {
        account?: string;
        name?: string;
        domain?: string;
        password?: string;
      },
      cmd: Command,
    ) => {
      await runTempMailAction(cmd, "Creating temp mailbox...", "Temp mailbox created.", () => tempMailAdapter.create(input));
    });

  command
    .command("login")
    .description("Save an existing mailbox, or create one when --address is omitted")
    .option("--account <name>", "Optional saved mailbox name")
    .option("--address <email>", "Existing mailbox address to save")
    .option("--password <text>", "Mailbox password. Required with --address; optional for new mailboxes")
    .option("--name <local-part>", "When creating a mailbox, optional email local part")
    .option("--domain <domain>", "When creating a mailbox, optional preferred domain")
    .action(async (
      input: {
        account?: string;
        address?: string;
        password?: string;
        name?: string;
        domain?: string;
      },
      cmd: Command,
    ) => {
      await runTempMailAction(cmd, "Saving temp mailbox...", "Temp mailbox saved.", () => tempMailAdapter.login(input));
    });

  command
    .command("status")
    .description("Check whether the saved temp mailbox still exists")
    .option("--account <name>", "Optional saved mailbox name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runTempMailAction(cmd, "Checking temp mailbox...", "Temp mailbox checked.", async () => {
        const status = await tempMailAdapter.getStatus(input.account);
        return {
          ok: true,
          platform: status.platform,
          account: status.account,
          action: "status",
          message: `Temp Mail connection is ${status.status}.`,
          user: status.user,
          sessionPath: status.sessionPath,
          data: {
            status: status.status,
            connected: status.connected,
            mailbox: {
              address: status.user?.username,
            },
            entity: {
              address: status.user?.username,
            },
            details: status.message,
            lastValidatedAt: status.lastValidatedAt,
          },
        } satisfies AdapterActionResult;
      });
    });

  command
    .command("me")
    .description("Show the saved mailbox summary")
    .option("--account <name>", "Optional saved mailbox name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runTempMailAction(cmd, "Loading temp mailbox...", "Temp mailbox loaded.", () => tempMailAdapter.me(input.account));
    });

  command
    .command("inbox")
    .description("List messages in the saved temp mailbox")
    .option("--account <name>", "Optional saved mailbox name")
    .option("--limit <number>", "Maximum messages to return (default: 20, max: 100)", parsePositiveInteger, 20)
    .action(async (input: { account?: string; limit: number }, cmd: Command) => {
      await runTempMailAction(cmd, "Loading temp mail inbox...", "Temp mail inbox loaded.", () => tempMailAdapter.inbox(input));
    });

  command
    .command("message")
    .description("Load one temp mail message by id")
    .argument("<id>", "Temp mail message id")
    .option("--account <name>", "Optional saved mailbox name")
    .option("--mark-read", "Mark the message as read after loading it")
    .action(async (id: string, input: { account?: string; markRead?: boolean }, cmd: Command) => {
      await runTempMailAction(cmd, "Loading temp mail message...", "Temp mail message loaded.", () =>
        tempMailAdapter.message({
          account: input.account,
          id,
          markRead: Boolean(input.markRead),
        }),
      );
    });

  command
    .command("wait")
    .description("Poll until a new temp mail message arrives")
    .option("--account <name>", "Optional saved mailbox name")
    .option("--timeout <seconds>", "Maximum seconds to wait (default: 120)", parsePositiveInteger, 120)
    .option("--interval <seconds>", "Polling interval in seconds (default: 3)", parsePositiveInteger, 3)
    .option("--limit <number>", "Maximum recent messages to compare while polling (default: 20)", parsePositiveInteger, 20)
    .action(async (input: { account?: string; timeout: number; interval: number; limit: number }, cmd: Command) => {
      await runTempMailAction(cmd, "Waiting for temp mail...", "Temp mail received.", () =>
        tempMailAdapter.wait({
          account: input.account,
          timeoutMs: input.timeout * 1000,
          intervalMs: input.interval * 1000,
          limit: input.limit,
        }),
      );
    });

  command
    .command("mark-read")
    .description("Mark one temp mail message as read")
    .argument("<id>", "Temp mail message id")
    .option("--account <name>", "Optional saved mailbox name")
    .action(async (id: string, input: { account?: string }, cmd: Command) => {
      await runTempMailAction(cmd, "Marking temp mail message as read...", "Temp mail message marked as read.", () =>
        tempMailAdapter.markRead({
          account: input.account,
          id,
        }),
      );
    });

  command
    .command("delete-message")
    .description("Delete one temp mail message")
    .argument("<id>", "Temp mail message id")
    .option("--account <name>", "Optional saved mailbox name")
    .action(async (id: string, input: { account?: string }, cmd: Command) => {
      await runTempMailAction(cmd, "Deleting temp mail message...", "Temp mail message deleted.", () =>
        tempMailAdapter.deleteMessage({
          account: input.account,
          id,
        }),
      );
    });

  command
    .command("delete-inbox")
    .description("Delete the remote mailbox and remove the saved local connection")
    .option("--account <name>", "Optional saved mailbox name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runTempMailAction(cmd, "Deleting temp mailbox...", "Temp mailbox deleted.", () => tempMailAdapter.deleteInbox(input.account));
    });

  return command;
}

async function runTempMailAction(
  cmd: Command,
  loadingText: string,
  successMessage: string,
  action: () => Promise<AdapterActionResult>,
): Promise<void> {
  const ctx = resolveCommandContext(cmd);
  const logger = new Logger(ctx);
  const spinner = logger.spinner(loadingText);

  await runCommandAction({
    spinner,
    successMessage,
    action,
    onSuccess: (result) => printTempMailResult(result, ctx.json),
  });
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AutoCliError("TEMPMAIL_OPTION_INVALID", `Expected a positive integer, received "${value}".`);
  }

  return parsed;
}

export const tempMailPlatformDefinition: PlatformDefinition = {
  id: "tempmail" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Temp Mail",
  description: "Create a free disposable inbox through Mail.tm and fetch incoming verification emails from the terminal",
  authStrategies: ["session"],
  buildCommand: buildTempMailCommand,
  adapter: tempMailAdapter,
  examples: EXAMPLES,
};
