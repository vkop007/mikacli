import { Command } from "commander";

import { buildExamplesHelpText } from "./example-help.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "./platform-definition.js";

export function buildPlatformCommand(
  definition: PlatformDefinition,
  options: PlatformCommandBuildOptions = {},
): Command {
  if (definition.buildCommand) {
    return definition.buildCommand(options);
  }

  if (!definition.capabilities || definition.capabilities.length === 0) {
    throw new Error(`Platform definition "${definition.id}" must provide either buildCommand or capabilities.`);
  }

  const command = new Command(definition.id).description(definition.description);

  for (const alias of definition.aliases ?? []) {
    command.alias(alias);
  }

  if (definition.examples && definition.examples.length > 0) {
    command.addHelpText("afterAll", buildExamplesHelpText(definition.examples, options));
  }

  for (const capability of definition.capabilities) {
    capability.register(command, definition);
  }

  return command;
}
