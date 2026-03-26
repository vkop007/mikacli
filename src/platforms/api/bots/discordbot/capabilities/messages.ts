import { createAdapterActionCapability } from "../../../../../core/runtime/capability-helpers.js";
import { discordBotAdapter } from "../adapter.js";
import { printDiscordMessageResult, printDiscordMessagesResult } from "../output.js";

function readTextArg(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((part) => String(part)).join(" ").trim();
  }

  return String(raw ?? "").trim();
}

export const discordBotSendCapability = createAdapterActionCapability({
  id: "send",
  command: "send <channelId> <text...>",
  description: "Send a Discord message to a channel",
  spinnerText: "Sending Discord message...",
  successMessage: "Discord message sent.",
  options: [
    { flags: "--reply-to <messageId>", description: "Reply to a specific Discord message id" },
    { flags: "--bot <name>", description: "Optional saved Discord bot name to use" },
  ],
  action: ({ args, options }) =>
    discordBotAdapter.sendMessage({
      account: options.bot as string | undefined,
      channelId: String(args[0] ?? ""),
      text: readTextArg(args[1]),
      replyToMessageId: options.replyTo as string | undefined,
    }),
  onSuccess: printDiscordMessageResult,
});

export const discordBotSendFileCapability = createAdapterActionCapability({
  id: "send-file",
  command: "send-file <channelId> <filePath>",
  aliases: ["file"],
  description: "Upload a file to a Discord channel with an optional message body",
  spinnerText: "Uploading Discord file...",
  successMessage: "Discord file sent.",
  options: [
    { flags: "--content <text>", description: "Optional message content to send with the file" },
    { flags: "--reply-to <messageId>", description: "Reply to a specific Discord message id" },
    { flags: "--bot <name>", description: "Optional saved Discord bot name to use" },
  ],
  action: ({ args, options }) =>
    discordBotAdapter.sendFile({
      account: options.bot as string | undefined,
      channelId: String(args[0] ?? ""),
      filePath: String(args[1] ?? ""),
      content: options.content as string | undefined,
      replyToMessageId: options.replyTo as string | undefined,
    }),
  onSuccess: printDiscordMessageResult,
});

export const discordBotHistoryCapability = createAdapterActionCapability({
  id: "history",
  command: "history <channelId>",
  description: "Load recent Discord messages from a channel",
  spinnerText: "Loading Discord messages...",
  successMessage: "Discord messages loaded.",
  options: [
    { flags: "--limit <count>", description: "Maximum number of messages to load (1-100)", parser: (value) => Number.parseInt(value, 10) },
    { flags: "--before <messageId>", description: "Only return messages before this message id" },
    { flags: "--after <messageId>", description: "Only return messages after this message id" },
    { flags: "--around <messageId>", description: "Return messages around this message id" },
    { flags: "--bot <name>", description: "Optional saved Discord bot name to use" },
  ],
  action: ({ args, options }) =>
    discordBotAdapter.history({
      account: options.bot as string | undefined,
      channelId: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      before: options.before as string | undefined,
      after: options.after as string | undefined,
      around: options.around as string | undefined,
    }),
  onSuccess: printDiscordMessagesResult,
});

export const discordBotEditCapability = createAdapterActionCapability({
  id: "edit",
  command: "edit <channelId> <messageId> <text...>",
  description: "Edit a Discord message in a channel",
  spinnerText: "Editing Discord message...",
  successMessage: "Discord message edited.",
  options: [{ flags: "--bot <name>", description: "Optional saved Discord bot name to use" }],
  action: ({ args, options }) =>
    discordBotAdapter.editMessage({
      account: options.bot as string | undefined,
      channelId: String(args[0] ?? ""),
      messageId: String(args[1] ?? ""),
      text: readTextArg(args[2]),
    }),
  onSuccess: printDiscordMessageResult,
});

export const discordBotDeleteCapability = createAdapterActionCapability({
  id: "delete",
  command: "delete <channelId> <messageId>",
  description: "Delete a Discord message from a channel",
  spinnerText: "Deleting Discord message...",
  successMessage: "Discord message deleted.",
  options: [{ flags: "--bot <name>", description: "Optional saved Discord bot name to use" }],
  action: ({ args, options }) =>
    discordBotAdapter.deleteMessage({
      account: options.bot as string | undefined,
      channelId: String(args[0] ?? ""),
      messageId: String(args[1] ?? ""),
    }),
});
