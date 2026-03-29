import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { normalizeLoginActionResult } from "../../../core/runtime/login-result.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext } from "../../../utils/cli.js";
import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";
import { telegramAdapter } from "./adapter.js";

import type { AdapterActionResult, AdapterStatusResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli telegram login --api-id 123456 --api-hash abcdef123456 --qr",
  "autocli telegram login --api-id 123456 --api-hash abcdef123456 --phone +911234567890",
  "autocli telegram me",
  "autocli telegram chats --limit 10",
  'autocli telegram history me --limit 20',
  'autocli telegram send me "Hello from AutoCLI"',
] as const;

function buildTelegramCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("telegram").description("Use a saved Telegram user session through MTProto");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("login")
    .description("Log in to Telegram with a QR code, phone/code flow, or an existing session string")
    .option("--account <name>", "Optional saved account name")
    .option("--api-id <id>", "Telegram app api_id from my.telegram.org")
    .option("--api-hash <hash>", "Telegram app api_hash from my.telegram.org")
    .option("--session-string <value>", "Existing Telegram StringSession value")
    .option("--phone <number>", "Phone number in international format for phone login")
    .option("--code <value>", "Telegram login code if you want a non-interactive login")
    .option("--password <value>", "Telegram 2FA password if enabled")
    .option("--qr", "Use QR login instead of phone/code login")
    .action(async (input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);

      try {
        const result = await telegramAdapter.login({
          account: input.account as string | undefined,
          apiId: input.apiId as string | undefined,
          apiHash: input.apiHash as string | undefined,
          sessionString: input.sessionString as string | undefined,
          phone: input.phone as string | undefined,
          code: input.code as string | undefined,
          password: input.password as string | undefined,
          qr: Boolean(input.qr),
          json: ctx.json,
        });
        printTelegramAction(normalizeLoginActionResult(result, telegramPlatformDefinition), ctx.json);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : "Telegram login failed.");
        throw error;
      }
    });

  command
    .command("status")
    .description("Show the saved Telegram session status")
    .option("--account <name>", "Optional saved account name")
    .action(async (input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Checking Telegram session...");

      try {
        const result = await telegramAdapter.getStatus(input.account as string | undefined);
        spinner?.succeed("Telegram session checked.");
        printTelegramStatus(result, ctx.json);
      } catch (error) {
        spinner?.stop();
        throw error;
      }
    });

  command
    .command("me")
    .description("Load the current Telegram user profile")
    .option("--account <name>", "Optional saved account name")
    .action(async (input: Record<string, unknown>, cmd: Command) => {
      await runTelegramAction("Loading Telegram profile...", "Telegram profile loaded.", ctxFrom(cmd), () =>
        telegramAdapter.me(input.account as string | undefined),
      );
    });

  command
    .command("chats")
    .alias("dialogs")
    .description("List recent Telegram dialogs/chats")
    .option("--account <name>", "Optional saved account name")
    .option("--limit <count>", "Maximum chats to load", (value) => Number.parseInt(value, 10), 20)
    .action(async (input: { account?: string; limit: number }, cmd: Command) => {
      await runTelegramAction("Loading Telegram chats...", "Telegram chats loaded.", ctxFrom(cmd), () =>
        telegramAdapter.chats({ account: input.account, limit: input.limit }),
      );
    });

  command
    .command("history")
    .description("Load recent Telegram messages for a chat, user, or channel")
    .argument("<target>", "Target chat: username, invite-style handle, me, or numeric id")
    .option("--account <name>", "Optional saved account name")
    .option("--limit <count>", "Maximum messages to load", (value) => Number.parseInt(value, 10), 20)
    .action(async (target: string, input: { account?: string; limit: number }, cmd: Command) => {
      await runTelegramAction("Loading Telegram history...", "Telegram history loaded.", ctxFrom(cmd), () =>
        telegramAdapter.history({ account: input.account, target, limit: input.limit }),
      );
    });

  command
    .command("send")
    .description("Send a text message from the saved Telegram user account")
    .argument("<target>", "Target chat: username, handle, me, or numeric id")
    .argument("<text...>", "Message text")
    .option("--account <name>", "Optional saved account name")
    .action(async (target: string, text: string[] | string, input: { account?: string }, cmd: Command) => {
      await runTelegramAction("Sending Telegram message...", "Telegram message sent.", ctxFrom(cmd), () =>
        telegramAdapter.send({
          account: input.account,
          target,
          text: Array.isArray(text) ? text.join(" ") : text,
        }),
      );
    });

  return command;
}

function ctxFrom(command: Command) {
  return resolveCommandContext(command);
}

async function runTelegramAction(
  loadingText: string,
  successText: string,
  ctx: ReturnType<typeof resolveCommandContext>,
  action: () => Promise<AdapterActionResult>,
): Promise<void> {
  const logger = new Logger(ctx);
  const spinner = logger.spinner(loadingText);

  try {
    const result = await action();
    spinner?.succeed(successText);
    printTelegramAction(result, ctx.json);
  } catch (error) {
    spinner?.stop();
    throw error;
  }
}

function printTelegramAction(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const profile = (result.data?.profile ?? result.data?.target ?? {}) as Record<string, unknown>;
  if (profile.username || profile.title) {
    for (const key of ["title", "username", "id", "url"] as const) {
      const value = profile[key];
      if (typeof value === "string" && value.length > 0) {
        console.log(`${key}: ${value}`);
      }
    }
  }

  const items = Array.isArray(result.data?.items) ? (result.data.items as Array<Record<string, unknown>>) : [];
  if (items.length > 0) {
    for (const item of items) {
      printTelegramItem(item);
    }
  }

  const message = (result.data?.message ?? {}) as Record<string, unknown>;
  if (Object.keys(message).length > 0) {
    console.log("message:");
    printTelegramItem(message);
  }
}

function printTelegramStatus(result: AdapterStatusResult, json: boolean): void {
  if (json) {
    printJson({
      ok: true,
      status: result,
    });
    return;
  }

  console.log(`platform: ${result.platform}`);
  console.log(`account: ${result.account}`);
  console.log(`status: ${result.status}`);
  console.log(`connected: ${result.connected ? "yes" : "no"}`);
  console.log(`session: ${result.sessionPath}`);

  if (result.user?.username) {
    console.log(`user: ${result.user.username}`);
  } else if (result.user?.displayName) {
    console.log(`user: ${result.user.displayName}`);
  }

  if (result.message) {
    console.log(`message: ${result.message}`);
  }
}

function printTelegramItem(item: Record<string, unknown>): void {
  const heading = pickString(item.title, item.username, item.text, item.id) ?? "-";
  console.log(heading);

  for (const key of ["id", "username", "date", "unreadCount", "text", "url"] as const) {
    const value = item[key];
    if (value !== undefined && value !== null && `${value}`.trim().length > 0 && `${value}` !== heading) {
      console.log(`${key}: ${value}`);
    }
  }

  console.log("");
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export const telegramPlatformDefinition: PlatformDefinition = {
  id: "telegram" as PlatformDefinition["id"],
  category: "social",
  displayName: "Telegram",
  description: "Control a Telegram user account through a saved MTProto session with QR, phone, or session-string login",
  authStrategies: ["session"],
  buildCommand: buildTelegramCommand,
  adapter: telegramAdapter,
  examples: EXAMPLES,
};
