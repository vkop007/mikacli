import { Command } from "commander";

import { slackbotCapabilities } from "./capabilities/index.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../../core/runtime/platform-definition.js";

export function createSlackbotCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("slackbot").description("Interact with Slack using a saved bot token");
  const prefix = options.examplePrefix ? `autocli ${options.examplePrefix} slackbot` : "autocli slackbot";

  command.alias("slack");
  command.addHelpText(
    "afterAll",
    `
Examples:
  ${prefix} login --token xoxb-123 --name alerts-bot
  ${prefix} me
  ${prefix} me --bot alerts-bot
  ${prefix} channels
  ${prefix} history general --limit 20
  ${prefix} send general "hello from AutoCLI"
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
  category: "api",
  displayName: "Slack Bot",
  description: "Interact with Slack using a saved bot token",
  aliases: ["slack"],
  authStrategies: ["botToken"],
  buildCommand: createSlackbotCommand,
  examples: [
    "autocli slackbot login --token xoxb-123 --name alerts-bot",
    "autocli slackbot me",
    "autocli slackbot me --bot alerts-bot",
    "autocli slackbot channels",
    "autocli slackbot history general --limit 20",
    'autocli slackbot send general "hello from AutoCLI"',
    'autocli slackbot send-file general ./build.log --comment "nightly build"',
    'autocli slackbot edit general 1700000000.000000 "updated text"',
    "autocli slackbot delete general 1700000000.000000",
  ],
};
