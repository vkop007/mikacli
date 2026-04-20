import { Command } from "commander";

import { slackbotCapabilities } from "./capabilities/index.js";
import { slackbotClient } from "./client.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export function createSlackbotCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("slackbot").description("Interact with Slack using a saved bot token");
  const prefix = options.examplePrefix ? `mikacli ${options.examplePrefix} slackbot` : "mikacli slackbot";

  command.alias("slack");
  command.addHelpText(
    "afterAll",
    `
Examples:
  ${prefix} login --token slack-bot-token-example --name alerts-bot
  ${prefix} me
  ${prefix} me --bot alerts-bot
  ${prefix} channels
  ${prefix} history general --limit 20
  ${prefix} send general "hello from MikaCLI"
  ${prefix} send-file general ./build.log --comment "nightly build"
  ${prefix} edit general 1700000000.000000 "updated text"
  ${prefix} delete general 1700000000.000000
`,
  );

  for (const capability of slackbotCapabilities) {
    capability.register(command);
  }

  return command;
}

export const slackbotPlatformDefinition: PlatformDefinition = {
  id: "slackbot",
  category: "bot",
  displayName: "Slack Bot",
  description: "Interact with Slack using a saved bot token",
  aliases: ["slack"],
  authStrategies: ["botToken"],
  adapter: slackbotClient,
  buildCommand: createSlackbotCommand,
  examples: [
    "mikacli slackbot login --token slack-bot-token-example --name alerts-bot",
    "mikacli slackbot me",
    "mikacli slackbot me --bot alerts-bot",
    "mikacli slackbot channels",
    "mikacli slackbot history general --limit 20",
    'mikacli slackbot send general "hello from MikaCLI"',
    'mikacli slackbot send-file general ./build.log --comment "nightly build"',
    'mikacli slackbot edit general 1700000000.000000 "updated text"',
    "mikacli slackbot delete general 1700000000.000000",
  ],
};
