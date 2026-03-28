import type { PlatformCommandBuildOptions } from "./platform-definition.js";

export function prefixCliExample(example: string, examplePrefix: string | undefined): string {
  if (!examplePrefix) {
    return example;
  }

  const normalized = example.replace(/^autocli\s+/u, "").trim();
  const expectedPrefix = `${examplePrefix} `;
  const withoutDuplicatePrefix =
    normalized.startsWith(expectedPrefix) ? normalized.slice(expectedPrefix.length) : normalized;

  return `autocli ${examplePrefix} ${withoutDuplicatePrefix}`.trim();
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
