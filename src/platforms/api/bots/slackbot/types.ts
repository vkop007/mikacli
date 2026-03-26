import type { AdapterActionResult } from "../../../../types.js";

export interface SlackbotAccountRecord {
  version: 1;
  account: string;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
  token: string;
  auth?: SlackbotAuthSummary;
}

export interface SlackbotAuthSummary {
  ok: true;
  team?: string;
  teamId?: string;
  url?: string;
  userId?: string;
  userName?: string;
  botUserId?: string;
  botName?: string;
}

export interface SlackbotChannelSummary {
  id: string;
  name: string;
  isPrivate: boolean;
  isArchived: boolean;
  memberCount?: number;
  topic?: string;
  purpose?: string;
}

export interface SlackbotActionResult extends Omit<AdapterActionResult, "platform"> {
  platform: "slackbot";
}

export interface SlackbotChannelsResult {
  ok: true;
  platform: "slackbot";
  account: string;
  action: "channels";
  message: string;
  sessionPath: string;
  channels: SlackbotChannelSummary[];
}

export interface SlackbotMessageSummary {
  ts: string;
  user?: string;
  text?: string;
  threadTs?: string;
  replyCount?: number;
  files?: Array<{
    id?: string;
    name?: string;
    mimetype?: string;
    urlPrivate?: string;
  }>;
}

export interface SlackbotHistoryResult {
  ok: true;
  platform: "slackbot";
  account: string;
  action: "history";
  message: string;
  sessionPath: string;
  channel: string;
  messages: SlackbotMessageSummary[];
  nextCursor?: string;
}
