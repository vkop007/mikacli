export interface TelegramBotConnectionMetadata {
  botUsername?: string;
  botId?: number;
  lastValidatedAt?: string;
}

export interface TelegramBotUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramBotChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
}

export interface TelegramBotMessage {
  message_id: number;
  date: number;
  chat: TelegramBotChat;
  text?: string;
  caption?: string;
  from?: TelegramBotUser;
}

export interface TelegramBotUpdate {
  update_id: number;
  message?: TelegramBotMessage;
  edited_message?: TelegramBotMessage;
  channel_post?: TelegramBotMessage;
  edited_channel_post?: TelegramBotMessage;
}

export interface TelegramBotApiErrorPayload {
  ok: false;
  error_code: number;
  description: string;
  parameters?: {
    retry_after?: number;
    migrate_to_chat_id?: number;
  };
}
