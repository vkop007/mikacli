import { Command } from "commander";
import pc from "picocolors";

import { AutoCliError } from "../errors.js";
import { prefixCliExample } from "../core/runtime/example-help.js";
import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import { buildPlatformCommandPrefix } from "../core/runtime/platform-command-prefix.js";
import { getPlatformCategories, getPlatformDefinitions } from "../platforms/index.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson } from "../utils/output.js";
import { createDoctorCommand } from "./doctor.js";
import { createLoginCommand } from "./login.js";
import { createSessionsCommand } from "./sessions.js";
import { createStatusCommand } from "./status.js";

import type { PlatformCategory, PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { Argument, Option } from "commander";

type SearchEntryKind = "root" | "provider" | "command";

export interface SearchEntry {
  kind: SearchEntryKind;
  category?: PlatformCategory;
  provider?: string;
  command: string;
  usage: string;
  label: string;
  description: string;
  aliases: string[];
  examples: string[];
  options: string[];
  searchText: string;
}

export interface SearchResult extends SearchEntry {
  score: number;
}

type RootSearchCommand = {
  builder: () => Command;
  examples: string[];
};

const ROOT_SEARCH_COMMANDS: readonly RootSearchCommand[] = [
  {
    builder: createLoginCommand,
    examples: [
      "autocli login --browser",
      "autocli login --url https://accounts.google.com/",
    ],
  },
  {
    builder: createStatusCommand,
    examples: ["autocli status --json"],
  },
  {
    builder: createDoctorCommand,
    examples: [
      "autocli doctor",
      "autocli doctor --fix",
    ],
  },
  {
    builder: createSessionsCommand,
    examples: [
      "autocli sessions",
      "autocli sessions validate",
      "autocli sessions validate x default",
      "autocli sessions show x default",
      "autocli sessions remove spotify default",
    ],
  },
] as const;

export function createSearchCommand(): Command {
  const command = new Command("search")
    .description("Search AutoCLI providers, commands, and examples")
    .argument("<query>", "Search query, for example github issues or youtube download")
    .option("--category <category>", "Filter results to one category, for example developer or tools")
    .option("--limit <count>", "Maximum results to return (default: 10)", parsePositiveInteger, 10)
    .addHelpText(
      "after",
      `
Examples:
  autocli search github
  autocli search youtube download
  autocli search uptime --category devops
  autocli search transcript --json
`,
    )
    .action(function searchAction(this: Command, query: string, options: { category?: string; limit: number }) {
      const ctx = resolveCommandContext(this);
      const category = normalizeSearchCategory(options.category);
      const index = buildSearchIndex();
      const results = searchCommandIndex(index, query, {
        category,
        limit: options.limit,
      });

      const payload = {
        ok: true,
        query: query.trim(),
        category: category ?? null,
        count: results.length,
        items: results.map(({ searchText: _searchText, score, ...entry }) => ({
          ...entry,
          score,
        })),
      };

      if (ctx.json) {
        printJson(payload);
        return;
      }

      printSearchResults(query, results, category);
    });

  return command;
}

export function buildSearchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const rootCommand of ROOT_SEARCH_COMMANDS) {
    const command = rootCommand.builder();
    const commandPath = `autocli ${command.name()}`;

    entries.push(buildSearchEntry({
      kind: "root",
      command: commandPath,
      usage: buildCommandUsage(commandPath, command),
      label: command.name(),
      description: command.description() || "No description.",
      aliases: command.aliases(),
      examples: rootCommand.examples,
      options: renderCommandOptions(command.options),
    }));

    entries.push(...collectSubcommandEntries({
      command,
      parentPath: commandPath,
      category: undefined,
      provider: command.name(),
      examples: rootCommand.examples,
    }));
  }

  for (const definition of getPlatformDefinitions()) {
    const prefixCategory = definition.commandCategories?.[0] ?? definition.category;
    const prefix = buildPlatformCommandPrefix(definition);
    const command = buildPlatformCommand(definition, { examplePrefix: prefixCategory });
    const examples = (definition.examples ?? []).map((example) => prefixCliExample(example, prefixCategory));

    entries.push(buildSearchEntry({
      kind: "provider",
      category: definition.category,
      provider: definition.id,
      command: prefix,
      usage: buildCommandUsage(prefix, command),
      label: definition.displayName,
      description: definition.description,
      aliases: [...(definition.aliases ?? []), ...command.aliases()],
      examples,
      options: renderCommandOptions(command.options),
    }));

    entries.push(...collectSubcommandEntries({
      command,
      parentPath: prefix,
      category: definition.category,
      provider: definition.id,
      examples,
    }));
  }

  return dedupeSearchEntries(entries);
}

export function searchCommandIndex(
  entries: readonly SearchEntry[],
  query: string,
  options: {
    category?: PlatformCategory;
    limit?: number;
  } = {},
): SearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = normalizedQuery.split(/\s+/u);
  const limit = clampSearchLimit(options.limit ?? 10);

  return entries
    .filter((entry) => !options.category || entry.category === options.category)
    .map((entry) => ({
      entry,
      score: scoreSearchEntry(entry, normalizedQuery, tokens),
    }))
    .filter((entry): entry is { entry: SearchEntry; score: number } => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.entry.kind !== right.entry.kind) {
        return compareKinds(left.entry.kind, right.entry.kind);
      }
      if (left.entry.command.length !== right.entry.command.length) {
        return left.entry.command.length - right.entry.command.length;
      }
      return left.entry.command.localeCompare(right.entry.command);
    })
    .slice(0, limit)
    .map(({ entry, score }) => ({
      ...entry,
      score,
    }));
}

function collectSubcommandEntries(input: {
  command: Command;
  parentPath: string;
  category?: PlatformCategory;
  provider?: string;
  examples: readonly string[];
}): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const subcommand of input.command.commands) {
    const commandPath = `${input.parentPath} ${subcommand.name()}`;
    const matchingExamples = input.examples.filter((example) => example.startsWith(commandPath));

    entries.push(buildSearchEntry({
      kind: "command",
      category: input.category,
      provider: input.provider,
      command: commandPath,
      usage: buildCommandUsage(commandPath, subcommand),
      label: subcommand.name(),
      description: subcommand.description() || "No description.",
      aliases: subcommand.aliases(),
      examples: matchingExamples,
      options: renderCommandOptions(subcommand.options),
    }));

    entries.push(...collectSubcommandEntries({
      command: subcommand,
      parentPath: commandPath,
      category: input.category,
      provider: input.provider,
      examples: input.examples,
    }));
  }

  return entries;
}

function buildSearchEntry(input: Omit<SearchEntry, "searchText">): SearchEntry {
  return {
    ...input,
    searchText: normalizeSearchText([
      input.kind,
      input.category ?? "",
      input.provider ?? "",
      input.command,
      input.usage,
      input.label,
      input.description,
      input.aliases.join(" "),
      input.examples.join(" "),
      input.options.join(" "),
    ].join(" ")),
  };
}

function buildCommandUsage(commandPath: string, command: Command): string {
  const usage = command.usage().trim();
  if (!usage) {
    const args = renderArguments(command.registeredArguments ?? []);
    return args ? `${commandPath} ${args}` : commandPath;
  }

  return `${commandPath} ${usage}`.trim();
}

function renderArguments(argumentsList: readonly Argument[]): string {
  return argumentsList
    .map((argument) => {
      const base = argument.variadic ? `${argument.name()}...` : argument.name();
      return argument.required ? `<${base}>` : `[${base}]`;
    })
    .join(" ");
}

function renderCommandOptions(options: readonly Option[]): string[] {
  return options.map((option) => `${option.flags} ${option.description ?? ""}`.trim());
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, " ").trim();
}

function scoreSearchEntry(entry: SearchEntry, query: string, tokens: readonly string[]): number {
  let score = 0;

  const queryMatched = entry.searchText.includes(query);
  if (queryMatched) {
    score += 60;
  }

  score += scoreField(entry.command, query, 260, 180, 130);
  score += scoreField(entry.usage, query, 240, 170, 120);
  score += scoreField(entry.label, query, 220, 160, 110);
  score += scoreField(entry.provider ?? "", query, 220, 160, 110);
  score += scoreField(entry.description, query, 120, 80, 55);

  const tokenScore = scoreTokens(entry, tokens);
  if (tokenScore === 0 && !queryMatched) {
    return 0;
  }

  score += tokenScore;

  if (entry.kind === "provider") {
    score += 8;
  } else if (entry.kind === "root") {
    score += 132;
  }

  score += Math.max(0, 22 - entry.command.split(/\s+/u).length * 4);

  return score;
}

function scoreTokens(entry: SearchEntry, tokens: readonly string[]): number {
  let score = 0;

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    if (normalizeSearchText(entry.command).includes(token)) {
      score += 50;
      continue;
    }

    if (normalizeSearchText(entry.label).includes(token)) {
      score += 42;
      continue;
    }

    if (normalizeSearchText(entry.provider ?? "").includes(token)) {
      score += 38;
      continue;
    }

    if (normalizeSearchText(entry.description).includes(token)) {
      score += 20;
      continue;
    }

    if (entry.examples.some((example) => normalizeSearchText(example).includes(token))) {
      score += 18;
      continue;
    }

    if (entry.options.some((option) => normalizeSearchText(option).includes(token))) {
      score += 12;
      continue;
    }

    return 0;
  }

  return score;
}

function scoreField(value: string, query: string, exact: number, startsWith: number, includes: number): number {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return 0;
  }

  if (normalized === query) {
    return exact;
  }

  if (normalized.startsWith(query)) {
    return startsWith;
  }

  if (normalized.includes(query)) {
    return includes;
  }

  return 0;
}

function dedupeSearchEntries(entries: readonly SearchEntry[]): SearchEntry[] {
  const seen = new Set<string>();
  const deduped: SearchEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.kind}:${entry.command}:${entry.usage}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function compareKinds(left: SearchEntryKind, right: SearchEntryKind): number {
  const rank: Record<SearchEntryKind, number> = {
    provider: 0,
    command: 1,
    root: 2,
  };

  return rank[left] - rank[right];
}

function normalizeSearchCategory(value?: string): PlatformCategory | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase() as PlatformCategory;
  if (getPlatformCategories().includes(normalized)) {
    return normalized;
  }

  throw new AutoCliError(
    "SEARCH_CATEGORY_INVALID",
    `Unknown category "${value}". Use one of: ${getPlatformCategories().join(", ")}.`,
  );
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function clampSearchLimit(value: number): number {
  return Math.max(1, Math.min(50, Math.round(value)));
}

function printSearchResults(query: string, results: readonly SearchResult[], category?: PlatformCategory): void {
  const title = category ? `Results for "${query}" in ${category}` : `Results for "${query}"`;
  console.log(pc.bold(title));

  if (results.length === 0) {
    console.log(pc.dim("No matching commands found."));
    return;
  }

  console.log(pc.dim(`${results.length} match${results.length === 1 ? "" : "es"}`));
  console.log("");

  for (const result of results) {
    const scope = [result.kind, result.category, result.provider].filter((value): value is string => Boolean(value)).join(" / ");
    console.log(`${pc.cyan(result.command)}${scope ? pc.dim(`  ${scope}`) : ""}`);
    console.log(`  ${result.description}`);
    if (result.examples[0]) {
      console.log(pc.dim(`  example: ${result.examples[0]}`));
    } else if (result.usage && result.usage !== result.command) {
      console.log(pc.dim(`  usage: ${result.usage}`));
    }
    console.log("");
  }
}
