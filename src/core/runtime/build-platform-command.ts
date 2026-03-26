import { Command } from "commander";

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
    command.addHelpText(
      "afterAll",
      `
Examples:
${definition.examples.map((example) => `  ${prefixPlatformExample(example, definition, options.examplePrefix)}`).join("\n")}
`,
    );
  }

  for (const capability of definition.capabilities) {
    capability.register(command, definition);
  }

  return command;
}

function prefixPlatformExample(example: string, definition: PlatformDefinition, prefix: string | undefined): string {
  if (!prefix) {
    return example;
  }

  const candidates = [definition.id, ...(definition.aliases ?? [])];
  for (const candidate of candidates) {
    const literal = `autocli ${candidate}`;
    if (example === literal || example.startsWith(`${literal} `)) {
      return example.replace(literal, `autocli ${prefix} ${candidate}`);
    }
  }

  return example;
}
