import type { PlatformCommandBuildOptions } from "./platform-definition.js";

export function prefixCliExample(example: string, examplePrefix: string | undefined): string {
  if (!examplePrefix) {
    return example;
  }

  return example.replace(/^autocli\s+/, `autocli ${examplePrefix} `);
}

export function buildExamplesHelpText(
  examples: readonly string[],
  options: PlatformCommandBuildOptions = {},
): string {
  if (examples.length === 0) {
    return "";
  }

  return `
Examples:
${examples.map((example) => `  ${prefixCliExample(example, options.examplePrefix)}`).join("\n")}
`;
}
