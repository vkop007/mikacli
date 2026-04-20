import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { normalizeActionResult } from "../../../core/runtime/login-result.js";
import { Logger } from "../../../logger.js";
import { printActionResult, resolveCommandContext } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";
import { whatsappAdapter } from "./adapter.js";

import type { AdapterActionResult, AdapterStatusResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli social whatsapp login",
  "mikacli social whatsapp login --phone +911234567890",
  "mikacli social whatsapp me",
  "mikacli social whatsapp chats --limit 10",
  "mikacli social whatsapp history 919876543210 --limit 20",
  'mikacli social whatsapp send 919876543210 "Hello from MikaCLI"',
] as const;

function buildWhatsAppCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("whatsapp").description("Use a saved WhatsApp user session with QR or pairing-code login");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("login")
    .description("Log in to WhatsApp with a QR code or a pairing code")
    .option("--account <name>", "Optional saved account name")
    .option("--phone <number>", "Generate a pairing code for this phone number instead of QR login")
    .action(async (input: { account?: string; phone?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);

      try {
        const result = await whatsappAdapter.login({
          account: input.account,
          phone: input.phone,
          json: ctx.json,
        });
        printWhatsAppAction(normalizeActionResult(result, whatsappPlatformDefinition, "login"), ctx.json);
        scheduleWhatsAppCliExit();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : "WhatsApp login failed.");
        scheduleWhatsAppCliExit();
        throw error;
      }
    });

  command
    .command("status")
    .description("Show the saved WhatsApp session status")
    .option("--account <name>", "Optional saved account name")
    .action(async (input: { account?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Checking WhatsApp session...");

      try {
        const result = await whatsappAdapter.getStatus(input.account);
        spinner?.succeed("WhatsApp session checked.");
        printWhatsAppStatus(result, ctx.json);
        scheduleWhatsAppCliExit();
      } catch (error) {
        spinner?.stop();
        scheduleWhatsAppCliExit();
        throw error;
      }
    });

  command
    .command("me")
    .description("Load the current WhatsApp account profile")
    .option("--account <name>", "Optional saved account name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runWhatsAppAction("Loading WhatsApp profile...", "WhatsApp profile loaded.", ctxFrom(cmd), () =>
        whatsappAdapter.me(input.account),
      );
    });

  command
    .command("chats")
    .description("List cached WhatsApp chats from the saved session")
    .option("--account <name>", "Optional saved account name")
    .option("--limit <count>", "Maximum chats to load", (value) => Number.parseInt(value, 10), 20)
    .action(async (input: { account?: string; limit: number }, cmd: Command) => {
      await runWhatsAppAction("Loading WhatsApp chats...", "WhatsApp chats loaded.", ctxFrom(cmd), () =>
        whatsappAdapter.chats({ account: input.account, limit: input.limit }),
      );
    });

  command
    .command("history")
    .description("Load cached WhatsApp messages for a user or chat jid")
    .argument("<target>", "Phone number, jid, or group id")
    .option("--account <name>", "Optional saved account name")
    .option("--limit <count>", "Maximum messages to load", (value) => Number.parseInt(value, 10), 20)
    .action(async (target: string, input: { account?: string; limit: number }, cmd: Command) => {
      await runWhatsAppAction("Loading WhatsApp history...", "WhatsApp history loaded.", ctxFrom(cmd), () =>
        whatsappAdapter.history({ account: input.account, target, limit: input.limit }),
      );
    });

  command
    .command("send")
    .description("Send a text message from the saved WhatsApp account")
    .argument("<target>", "Phone number, jid, or group id")
    .argument("<text...>", "Message text")
    .option("--account <name>", "Optional saved account name")
    .action(async (target: string, text: string[] | string, input: { account?: string }, cmd: Command) => {
      await runWhatsAppAction("Sending WhatsApp message...", "WhatsApp message sent.", ctxFrom(cmd), () =>
        whatsappAdapter.send({
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

async function runWhatsAppAction(
  loadingText: string,
  successText: string,
  ctx: ReturnType<typeof resolveCommandContext>,
  action: () => Promise<AdapterActionResult>,
): Promise<void> {
  const logger = new Logger(ctx);
  const spinner = logger.spinner(loadingText);

  try {
    const result = normalizeActionResult(await action(), whatsappPlatformDefinition);
    spinner?.succeed(successText);
    printWhatsAppAction(result, ctx.json);
    scheduleWhatsAppCliExit();
  } catch (error) {
    spinner?.stop();
    scheduleWhatsAppCliExit();
    throw error;
  }
}

function printWhatsAppAction(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const profile = (result.data?.profile ?? result.data?.target ?? {}) as Record<string, unknown>;
  if (profile.username || profile.id) {
    for (const key of ["displayName", "username", "id"] as const) {
      const value = profile[key];
      if (typeof value === "string" && value.length > 0) {
        console.log(`${key}: ${value}`);
      }
    }
  }

  const items = Array.isArray(result.data?.items) ? (result.data.items as Array<Record<string, unknown>>) : [];
  if (items.length > 0) {
    for (const item of items) {
      printWhatsAppItem(item);
    }
  }

  const message = (result.data?.message ?? {}) as Record<string, unknown>;
  if (Object.keys(message).length > 0) {
    console.log("message:");
    printWhatsAppItem(message);
  }
}

function printWhatsAppStatus(result: AdapterStatusResult, json: boolean): void {
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

  if (result.user?.displayName) {
    console.log(`user: ${result.user.displayName}`);
  } else if (result.user?.username) {
    console.log(`user: ${result.user.username}`);
  }

  if (result.message) {
    console.log(`message: ${result.message}`);
  }
}

function printWhatsAppItem(item: Record<string, unknown>): void {
  const heading = pickString(item.name, item.jid, item.text, item.id) ?? "-";
  console.log(heading);

  for (const key of ["jid", "id", "timestamp", "text", "sender", "unreadCount"] as const) {
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

function scheduleWhatsAppCliExit(): void {
  const exitTimer = setTimeout(() => {
    process.exit(process.exitCode ?? 0);
  }, 50);

  exitTimer.unref();
}

export const whatsappPlatformDefinition: PlatformDefinition = {
  id: "whatsapp" as PlatformDefinition["id"],
  category: "social",
  displayName: "WhatsApp",
  description: "Control a WhatsApp user session with QR or pairing-code login and saved auth state",
  authStrategies: ["session"],
  buildCommand: buildWhatsAppCommand,
  adapter: whatsappAdapter,
  examples: EXAMPLES,
};
