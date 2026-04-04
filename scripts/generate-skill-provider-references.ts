import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prefixCliExample } from "../src/core/runtime/example-help.ts";
import { resolvePlatformCapabilityMetadata } from "../src/core/runtime/platform-capability-metadata.ts";
import { buildPlatformCommand } from "../src/core/runtime/build-platform-command.ts";
import { buildPlatformCommandPrefix } from "../src/core/runtime/platform-command-prefix.ts";
import { getPlatformCategories, getPlatformDefinitions, getPlatformDefinitionsByCategory } from "../src/platforms/index.ts";

import type { Command, Option } from "commander";
import type { Argument } from "commander";
import type { PlatformDefinition } from "../src/core/runtime/platform-definition.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(__dirname);
const skillRoot = join(repoRoot, "skills", "autocli");
const providerDir = join(skillRoot, "references", "providers");
const providerIndexPath = join(providerDir, "index.md");

const SAFE_DISCOVERY_COMMANDS = [
  "me",
  "status",
  "account",
  "repos",
  "projects",
  "spaces",
  "services",
  "apps",
  "zones",
  "boards",
  "teams",
  "accounts",
  "organizations",
  "sites",
  "deployments",
  "functions",
  "sources",
  "top",
  "inspect",
  "search",
  "profile",
  "title",
  "posts",
  "cart",
] as const;

async function main(): Promise<void> {
  const definitions = [...getPlatformDefinitions()].sort((left, right) => left.id.localeCompare(right.id));
  await rm(providerDir, { recursive: true, force: true });
  await mkdir(providerDir, { recursive: true });

  for (const definition of definitions) {
    const markdown = renderProviderReference(definition);
    await writeFile(join(providerDir, `${definition.id}.md`), markdown, "utf8");
  }

  await writeFile(providerIndexPath, renderProviderIndex(), "utf8");
}

function renderProviderReference(definition: PlatformDefinition): string {
  const prefixCategory = definition.commandCategories?.[0] ?? definition.category;
  const prefix = buildPlatformCommandPrefix(definition);
  const metadata = resolvePlatformCapabilityMetadata(definition);
  const command = buildPlatformCommand(definition, { examplePrefix: prefixCategory });
  const examples = (definition.examples ?? []).map((example) => prefixCliExample(example, prefixCategory));
  const quickStarts = buildQuickStarts(definition, command, prefix, examples);
  const defaultUsage = buildDefaultUsage(prefix, command);
  const rootOptions = renderOptions(command.options);
  const subcommands = command.commands.map((subcommand) => renderSubcommand(prefix, subcommand)).join("\n");
  const aliases = definition.aliases?.length ? definition.aliases.map((alias) => `\`${alias}\``).join(", ") : "none";
  const notes = metadata.notes?.length ? metadata.notes.map((note) => `- ${note}`).join("\n") : "- none";

  return `# ${definition.displayName}

Generated from the real AutoCLI provider definition and command tree.

- Provider: \`${definition.id}\`
- Category: \`${definition.category}\`
- Command prefix: \`${prefix}\`
- Aliases: ${aliases}
- Auth: ${formatList(metadata.auth)}
- Stability: \`${metadata.stability}\`
- Discovery: \`${metadata.discovery}\`
- Mutation: \`${metadata.mutation}\`
- Browser login: \`${metadata.browserLogin}\`
- Browser fallback: \`${metadata.browserFallback}\`
- Async jobs: \`${metadata.asyncJobs}\`

## Description

${definition.description}

## Notes

${notes}

## Fast Start

${quickStarts}

## Default Command

Usage:
\`\`\`bash
${defaultUsage}
\`\`\`

${rootOptions ? `Options:\n\n${rootOptions}\n` : "No root-only options.\n"}

## Commands

${subcommands}`.trimEnd() + "\n";
}

function renderProviderIndex(): string {
  const categories = getPlatformCategories();
  const lines = [
    "# AutoCLI Provider References",
    "",
    "Generated provider-specific references for every AutoCLI provider.",
    "",
    "Use these files when the main `$autocli` skill already knows the provider and needs its exact command surface quickly.",
    "",
  ];

  for (const category of categories) {
    const definitions = [...getPlatformDefinitionsByCategory(category)].sort((left, right) => left.id.localeCompare(right.id));
    lines.push(`## ${category}`);
    lines.push("");
    for (const definition of definitions) {
      lines.push(`- [${definition.displayName}](./${definition.id}.md)`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function buildQuickStarts(
  definition: PlatformDefinition,
  command: Command,
  prefix: string,
  examples: readonly string[],
): string {
  const lines: string[] = [];

  if (examples.length > 0) {
    for (const example of examples.slice(0, 3)) {
      lines.push(`- \`${example}\``);
    }
  }

  if (lines.length === 0) {
    const subcommand = command.commands.find((candidate) => SAFE_DISCOVERY_COMMANDS.includes(candidate.name() as (typeof SAFE_DISCOVERY_COMMANDS)[number]));
    if (subcommand) {
      lines.push(`- \`${prefix} ${buildCommandUsage(subcommand)} --json\``.replace(" [options] --json", " --json"));
    } else {
      lines.push(`- \`${prefix} capabilities --json\``);
    }
  }

  if (!lines.some((line) => line.includes("capabilities --json"))) {
    lines.push(`- \`${prefix} capabilities --json\``);
  }

  return lines.join("\n");
}

function buildDefaultUsage(prefix: string, command: Command): string {
  const args = renderArguments(command.registeredArguments ?? []);
  const hasOptions = command.options.length > 0;
  const hasSubcommands = command.commands.length > 0;
  const commandPart = args.length > 0 ? ` ${args}` : "";
  const optionsPart = hasOptions ? " [options]" : "";
  const subcommandsPart = hasSubcommands ? " [command]" : "";
  return `${prefix}${optionsPart}${subcommandsPart}${commandPart}`;
}

function buildCommandUsage(command: Command): string {
  const usage = command.usage().trim();
  if (usage.length === 0) {
    return command.name();
  }

  return `${command.name()} ${usage}`.trim();
}

function renderSubcommand(prefix: string, command: Command): string {
  const usage = `${prefix} ${buildCommandUsage(command)}`.trim();
  const aliases = command.aliases();
  const options = renderOptions(command.options);
  const aliasLine = aliases.length > 0 ? `Aliases: ${aliases.map((alias) => `\`${alias}\``).join(", ")}\n\n` : "";

  return `### \`${command.name()}\`

Usage:
\`\`\`bash
${usage}
\`\`\`

${aliasLine}${command.description() || "No description."}

${options ? `Options:\n\n${options}` : "No command-specific options."}
`;
}

function renderOptions(options: readonly Option[]): string {
  if (options.length === 0) {
    return "";
  }

  return options
    .map((option) => `- \`${option.flags}\`: ${option.description || "No description."}`)
    .join("\n");
}

function renderArguments(argumentsList: readonly Argument[]): string {
  return argumentsList
    .map((argument) => {
      const base = argument.variadic ? `${argument.name()}...` : argument.name();
      return argument.required ? `<${base}>` : `[${base}]`;
    })
    .join(" ");
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "`none`";
}

await main();
