import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { telegrambotAdapter } from "../adapter.js";
import { parseTelegramMessageIdOption } from "../options.js";

export const telegrambotSendCapability = createAdapterActionCapability({
  id: "send",
  command: "send <chatId> <text...>",
  description: "Send a Telegram text message to a chat id or public @username",
  spinnerText: "Sending Telegram message...",
  successMessage: "Telegram message sent.",
  options: [
    { flags: "--parse-mode <mode>", description: "Optional Telegram parse mode such as MarkdownV2 or HTML" },
    { flags: "--disable-web-page-preview", description: "Disable link previews in the message body" },
    { flags: "--reply-to <messageId>", description: "Reply to a specific message id", parser: parseTelegramMessageIdOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ args, options }) =>
    telegrambotAdapter.send({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      text: args.slice(1).map((part) => String(part)).join(" "),
      parseMode: options.parseMode as string | undefined,
      disableWebPagePreview: Boolean(options.disableWebPagePreview),
      replyToMessageId: options.replyTo as number | undefined,
    }),
});

export const telegrambotSendPhotoCapability = createAdapterActionCapability({
  id: "send-photo",
  command: "send-photo <chatId> <photo>",
  aliases: ["photo"],
  description: "Send a Telegram photo from a URL, file path, or file id",
  spinnerText: "Sending Telegram photo...",
  successMessage: "Telegram photo sent.",
  options: [
    { flags: "--caption <text>", description: "Optional photo caption" },
    { flags: "--parse-mode <mode>", description: "Optional Telegram parse mode for the caption" },
    { flags: "--reply-to <messageId>", description: "Reply to a specific message id", parser: parseTelegramMessageIdOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ args, options }) =>
    telegrambotAdapter.sendPhoto({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      photo: String(args[1] ?? ""),
      caption: options.caption as string | undefined,
      parseMode: options.parseMode as string | undefined,
      replyToMessageId: options.replyTo as number | undefined,
    }),
});

export const telegrambotSendDocumentCapability = createAdapterActionCapability({
  id: "send-document",
  command: "send-document <chatId> <document>",
  aliases: ["document"],
  description: "Send a Telegram document from a URL, file path, or file id",
  spinnerText: "Sending Telegram document...",
  successMessage: "Telegram document sent.",
  options: [
    { flags: "--caption <text>", description: "Optional document caption" },
    { flags: "--parse-mode <mode>", description: "Optional Telegram parse mode for the caption" },
    { flags: "--reply-to <messageId>", description: "Reply to a specific message id", parser: parseTelegramMessageIdOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ args, options }) =>
    telegrambotAdapter.sendDocument({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      document: String(args[1] ?? ""),
      caption: options.caption as string | undefined,
      parseMode: options.parseMode as string | undefined,
      replyToMessageId: options.replyTo as number | undefined,
    }),
});

export const telegrambotSendVideoCapability = createAdapterActionCapability({
  id: "send-video",
  command: "send-video <chatId> <video>",
  aliases: ["video"],
  description: "Send a Telegram video from a URL, file path, or file id",
  spinnerText: "Sending Telegram video...",
  successMessage: "Telegram video sent.",
  options: [
    { flags: "--caption <text>", description: "Optional video caption" },
    { flags: "--parse-mode <mode>", description: "Optional Telegram parse mode for the caption" },
    { flags: "--reply-to <messageId>", description: "Reply to a specific message id", parser: parseTelegramMessageIdOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ args, options }) =>
    telegrambotAdapter.sendVideo({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      video: String(args[1] ?? ""),
      caption: options.caption as string | undefined,
      parseMode: options.parseMode as string | undefined,
      replyToMessageId: options.replyTo as number | undefined,
    }),
});

export const telegrambotSendAudioCapability = createAdapterActionCapability({
  id: "send-audio",
  command: "send-audio <chatId> <audio>",
  aliases: ["audio"],
  description: "Send a Telegram audio file from a URL, file path, or file id",
  spinnerText: "Sending Telegram audio...",
  successMessage: "Telegram audio sent.",
  options: [
    { flags: "--caption <text>", description: "Optional audio caption" },
    { flags: "--parse-mode <mode>", description: "Optional Telegram parse mode for the caption" },
    { flags: "--reply-to <messageId>", description: "Reply to a specific message id", parser: parseTelegramMessageIdOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ args, options }) =>
    telegrambotAdapter.sendAudio({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      audio: String(args[1] ?? ""),
      caption: options.caption as string | undefined,
      parseMode: options.parseMode as string | undefined,
      replyToMessageId: options.replyTo as number | undefined,
    }),
});

export const telegrambotSendVoiceCapability = createAdapterActionCapability({
  id: "send-voice",
  command: "send-voice <chatId> <voice>",
  aliases: ["voice"],
  description: "Send a Telegram voice note from a URL, file path, or file id",
  spinnerText: "Sending Telegram voice note...",
  successMessage: "Telegram voice note sent.",
  options: [
    { flags: "--caption <text>", description: "Optional voice caption" },
    { flags: "--parse-mode <mode>", description: "Optional Telegram parse mode for the caption" },
    { flags: "--reply-to <messageId>", description: "Reply to a specific message id", parser: parseTelegramMessageIdOption },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ args, options }) =>
    telegrambotAdapter.sendVoice({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      voice: String(args[1] ?? ""),
      caption: options.caption as string | undefined,
      parseMode: options.parseMode as string | undefined,
      replyToMessageId: options.replyTo as number | undefined,
    }),
});

export const telegrambotEditCapability = createAdapterActionCapability({
  id: "edit",
  command: "edit <chatId> <messageId> <text...>",
  description: "Edit a Telegram message text or caption",
  spinnerText: "Editing Telegram message...",
  successMessage: "Telegram message edited.",
  options: [
    { flags: "--caption", description: "Edit the message caption instead of the text" },
    { flags: "--parse-mode <mode>", description: "Optional Telegram parse mode" },
    { flags: "--disable-web-page-preview", description: "Disable link previews when editing text" },
    { flags: "--bot <name>", description: "Optional saved Telegram bot name to use" },
  ],
  action: ({ args, options }) =>
    telegrambotAdapter.edit({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      messageId: Number.parseInt(String(args[1] ?? ""), 10),
      text: args.slice(2).map((part) => String(part)).join(" "),
      caption: Boolean(options.caption),
      parseMode: options.parseMode as string | undefined,
      disableWebPagePreview: Boolean(options.disableWebPagePreview),
    }),
});

export const telegrambotDeleteCapability = createAdapterActionCapability({
  id: "delete",
  command: "delete <chatId> <messageId>",
  description: "Delete a Telegram message",
  spinnerText: "Deleting Telegram message...",
  successMessage: "Telegram message deleted.",
  options: [{ flags: "--bot <name>", description: "Optional saved Telegram bot name to use" }],
  action: ({ args, options }) =>
    telegrambotAdapter.delete({
      account: options.bot as string | undefined,
      chatId: String(args[0] ?? ""),
      messageId: Number.parseInt(String(args[1] ?? ""), 10),
    }),
});
