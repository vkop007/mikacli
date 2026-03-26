import { createAdapterActionCapability } from "../../../../../core/runtime/capability-helpers.js";
import { telegrambotAdapter } from "../adapter.js";
import { parseTelegramLimitOption, parseTelegramOffsetOption } from "../options.js";
import { printTelegramChatResult, printTelegramChatsResult, printTelegramMeResult, printTelegramUpdatesResult } from "../output.js";

export const telegrambotMeCapability = createAdapterActionCapability({
  id: "me",
  command: "me",
  description: "Show the saved Telegram bot profile",
  spinnerText: "Loading Telegram bot profile...",
  successMessage: "Telegram bot profile loaded.",
  options: [{ flags: "--bot <name>", description: "Optional saved Telegram bot name to use" }],
  action: ({ options }) => telegrambotAdapter.me(options.bot as string | undefined),
  onSuccess: printTelegramMeResult,
});

export const telegrambotGetChatCapability = createAdapterActionCapability({
  id: "getchat",
  command: "getchat <chatId>",
  aliases: ["chat"],
  description: "Load a Telegram chat by chat id or public @username",
  spinnerText: "Loading Telegram chat...",
  successMessage: "Telegram chat loaded.",
  options: [{ flags: "--bot <name>", description: "Optional saved Telegram bot name to use" }],
  action: ({ args, options }) =>
    telegrambotAdapter.getChat({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
    }),
  onSuccess: printTelegramChatResult,
});

export const telegrambotChatsCapability = createAdapterActionCapability({
  id: "chats",
  command: "chats",
  description: "List recent chats seen by the bot in updates",
  spinnerText: "Loading Telegram chats...",
  successMessage: "Telegram chats loaded.",
  options: [
    { flags: "--limit <number>", description: "Maximum number of updates to inspect", parser: parseTelegramLimitOption },
    { flags: "--offset <number>", description: "Update offset for pagination", parser: parseTelegramOffsetOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ options }) =>
    telegrambotAdapter.chats({
      account: options.bot as string | undefined,
      limit: options.limit as number | undefined,
      offset: options.offset as number | undefined,
    }),
  onSuccess: printTelegramChatsResult,
});

export const telegrambotUpdatesCapability = createAdapterActionCapability({
  id: "updates",
  command: "updates",
  description: "Fetch recent Telegram bot updates",
  spinnerText: "Loading Telegram updates...",
  successMessage: "Telegram updates loaded.",
  options: [
    { flags: "--limit <number>", description: "Maximum number of updates to fetch", parser: parseTelegramLimitOption },
    { flags: "--offset <number>", description: "Update offset for pagination", parser: parseTelegramOffsetOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ options }) =>
    telegrambotAdapter.updates({
      account: options.bot as string | undefined,
      limit: options.limit as number | undefined,
      offset: options.offset as number | undefined,
    }),
  onSuccess: printTelegramUpdatesResult,
});
