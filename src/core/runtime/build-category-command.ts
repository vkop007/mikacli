import { Command } from "commander";

import { buildPlatformCommand } from "./build-platform-command.js";

import type { PlatformCategory, PlatformDefinition } from "./platform-definition.js";

interface PlatformCategoryDefinition {
  description: string;
}

const PLATFORM_CATEGORY_DEFINITIONS: Record<PlatformCategory, PlatformCategoryDefinition> = {
  bot: {
    description: "Bot-token providers like Telegram, Discord, and Slack",
  },
  developer: {
    description: "Developer platforms like GitHub, GitLab, Linear, and Notion",
  },
  editor: {
    description: "Local media editors powered by tools like ffmpeg",
  },
  finance: {
    description: "Public market, crypto, and forex lookup tools",
  },
  data: {
    description: "Structured data cleanup, conversion, querying, and extraction tools",
  },
  forum: {
    description: "Forum-style communities and discussion platforms",
  },
  llm: {
    description: "Browserless LLM web apps with proven runtime flows",
  },
  maps: {
    description: "Public maps, geocoding, and route lookup tools",
  },
  movie: {
    description: "Movie and anime lookup tools with public and optional cookie-backed flows",
  },
  music: {
    description: "Music platforms like Spotify and YouTube Music",
  },
  shopping: {
    description: "Shopping platforms like Amazon and Flipkart",
  },
  social: {
    description: "Social platforms like Instagram, X, Facebook, and YouTube",
  },
  tools: {
    description: "General-purpose tools and public utilities",
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
