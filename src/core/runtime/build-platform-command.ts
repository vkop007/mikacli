import { Command } from "commander";

import { buildExamplesHelpText } from "./example-help.js";
import { buildCapabilityMetadataHelpText, registerCapabilityMetadataCommand } from "./platform-capability-metadata.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "./platform-definition.js";

export function buildPlatformCommand(
  definition: PlatformDefinition,
  options: PlatformCommandBuildOptions = {},
): Command {
  const command = definition.buildCommand
    ? definition.buildCommand(options)
    : buildCapabilityDrivenPlatformCommand(definition);

  for (const alias of definition.aliases ?? []) {
    command.alias(alias);
  }

  registerCapabilityMetadataCommand(command, definition);
  command.addHelpText("afterAll", buildCapabilityMetadataHelpText(definition));

  if (definition.examples && definition.examples.length > 0) {
    command.addHelpText("afterAll", buildExamplesHelpText(definition.examples, options));
  }

  return command;
}

function buildCapabilityDrivenPlatformCommand(definition: PlatformDefinition): Command {
  if (definition.buildCommand) {
    return definition.buildCommand();
  }

  if (!definition.capabilities || definition.capabilities.length === 0) {
    throw new Error(`Platform definition "${definition.id}" must provide either buildCommand or capabilities.`);
  }

  const command = new Command(definition.id).description(definition.description);

  for (const capability of definition.capabilities) {
    capability.register(command, definition);
  }

  return command;
}
