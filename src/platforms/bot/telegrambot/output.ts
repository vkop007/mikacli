import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";
import type { TelegramBotChat, TelegramBotMessage, TelegramBotUpdate, TelegramBotUser } from "./types.js";

type TelegramListResult = AdapterActionResult & {
  data?: {
    items?: Array<Record<string, unknown>>;
    chats?: TelegramBotChatSummary[];
    updates?: TelegramBotUpdateSummary[];
    me?: TelegramBotUser;
    chat?: TelegramBotChat;
    message?: TelegramBotMessage;
    [key: string]: unknown;
  };
};

interface TelegramBotChatSummary {
  id: number;
  type: TelegramBotChat["type"];
  title?: string;
  username?: string;
  name?: string;
  lastMessagePreview?: string;
  updateId: number;
}

interface TelegramBotUpdateSummary {
  updateId: number;
  kind: string;
  chatId?: number;
  chatName?: string;
  messagePreview?: string;
}

export function printTelegramMeResult(result: TelegramListResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  const me = result.data?.me;
  if (me) {
    const username = me.username ? `@${me.username}` : undefined;
    const displayName = [me.first_name, me.last_name].filter(Boolean).join(" ");
    console.log(result.message);
    console.log(`id: ${me.id}`);
    if (username) {
      console.log(`username: ${username}`);
    }
    if (displayName) {
      console.log(`name: ${displayName}`);
    }
    return;
  }

  console.log(result.message);
}

export function printTelegramChatResult(result: TelegramListResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  const chat = result.data?.chat;
  if (!chat) {
    console.log(result.message);
    return;
  }

  const identity = chat.username ? `@${chat.username}` : chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ");
  console.log(result.message);
  console.log(`id: ${chat.id}`);
  console.log(`type: ${chat.type}`);
  if (identity) {
    console.log(`name: ${identity}`);
  }
  if (chat.description) {
    console.log(`description: ${chat.description}`);
  }
}

export function printTelegramChatsResult(result: TelegramListResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  const chats = result.data?.chats ?? [];
  console.log(result.message);
  if (chats.length === 0) {
    console.log("No chats found in recent updates.");
    return;
  }

  for (const [index, chat] of chats.entries()) {
    const name = chat.username ? `@${chat.username}` : chat.title ?? chat.name ?? "-";
    console.log(`${index + 1}. ${name}`);
    console.log(`   id: ${chat.id} • type: ${chat.type}`);
    if (chat.lastMessagePreview) {
      console.log(`   last message: ${chat.lastMessagePreview}`);
    }
  }
}

export function printTelegramUpdatesResult(result: TelegramListResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  const updates = result.data?.updates ?? [];
  console.log(result.message);
  if (updates.length === 0) {
    console.log("No recent updates found.");
    return;
  }

  for (const [index, update] of updates.entries()) {
    const chatName = update.chatName ?? (update.chatId ? String(update.chatId) : "-");
    console.log(`${index + 1}. update #${update.updateId} • ${update.kind} • ${chatName}`);
    if (update.messagePreview) {
      console.log(`   ${update.messagePreview}`);
    }
  }
}
