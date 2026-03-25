import pc from "picocolors";

import { printJson } from "../../../utils/output.js";

import type { SlackbotChannelsResult, SlackbotHistoryResult } from "./types.js";

export function printSlackbotChannels(result: SlackbotChannelsResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  if (result.channels.length === 0) {
    console.log(pc.dim("No Slack channels found."));
    return;
  }

  for (const channel of result.channels) {
    const prefix = channel.isPrivate ? `${pc.yellow("private")} ` : pc.cyan("#");
    const topic = channel.topic ? pc.dim(` - ${channel.topic}`) : "";
    const count = typeof channel.memberCount === "number" ? pc.dim(` (${channel.memberCount} members)`) : "";
    console.log(`${prefix}${channel.name} ${pc.dim(channel.id)}${count}${topic}`);
  }
}

export function printSlackbotHistory(result: SlackbotHistoryResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  if (result.messages.length === 0) {
    console.log(pc.dim("No Slack messages found."));
    return;
  }

  for (const [index, message] of result.messages.entries()) {
    const meta = [
      message.ts,
      message.user,
      typeof message.replyCount === "number" ? `${message.replyCount} replies` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${meta.join(" • ")}`);

    if (typeof message.text === "string" && message.text.trim().length > 0) {
      console.log(`   ${message.text.trim()}`);
    }

    if (Array.isArray(message.files) && message.files.length > 0) {
      const files = message.files
        .map((file) => file.name)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (files.length > 0) {
        console.log(`   files: ${files.join(", ")}`);
      }
    }
  }
}
