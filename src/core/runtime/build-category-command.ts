import { Command } from "commander";

import { buildPlatformCommand } from "./build-platform-command.js";

import type { PlatformCategory, PlatformDefinition } from "./platform-definition.js";

interface PlatformCategoryDefinition {
  description: string;
}

const PLATFORM_CATEGORY_DEFINITIONS: Record<PlatformCategory, PlatformCategoryDefinition> = {
  api: {
    description: "API-token providers and developer integrations",
  },
  bots: {
    description: "Bot-token providers like Telegram, Discord, and Slack",
  },
  forum: {
    description: "Forum-style communities and discussion platforms",
  },
  llm: {
    description: "Browserless LLM web apps with proven cookie-backed session flows",
  },
  music: {
    description: "Music platforms like Spotify and YouTube Music",
  },
  public: {
    description: "No-auth public utilities and lookup tools",
  },
  social: {
    description: "Social platforms like Instagram, X, Facebook, and YouTube",
  },
};

export function buildCategoryCommand(category: PlatformCategory, definitions: readonly PlatformDefinition[]): Command {
  const metadata = PLATFORM_CATEGORY_DEFINITIONS[category];
  const command = new Command(category).description(metadata.description);

  for (const definition of definitions) {
    command.addCommand(buildPlatformCommand(definition, { examplePrefix: category }));
  }

  return command;
}
