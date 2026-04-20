import { Command } from "commander";
import pc from "picocolors";

import packageJson from "../package.json" with { type: "json" };
import { createDoctorCommand } from "./commands/doctor.js";
import { createLoginCommand } from "./commands/login.js";
import { createUpgradeCommand } from "./commands/upgrade.js";
import { createLogoutCommand } from "./commands/logout.js";
import { createSearchCommand } from "./commands/search.js";
import { createSessionsCommand } from "./commands/sessions.js";
import { createStatusCommand } from "./commands/status.js";
import { createLogsCommand } from "./commands/logs.js";
import { createJobsCommand } from "./commands/jobs.js";
import { MikaCliError } from "./errors.js";
import { buildCategoryCommand } from "./core/runtime/build-category-command.js";
import { getPlatformCategories, getPlatformDefinitions, getPlatformDefinitionsByCategory } from "./platforms/index.js";

const HELP_FRAME = `${pc.bold(pc.cyan("MikaCLI"))}
${pc.dim("Terminal automation across LLMs, editors, finance, data, Google apps, maps, movies, news, socials, shopping, developer platforms, devops, bots, and tools")}
`;

const ROOT_EXAMPLES = [
  "mikacli login --browser",
  "mikacli logout x default",
  'mikacli search "youtube download"',
  'mikacli llm chatgpt text "Hello my name is Justine"',
  "mikacli doctor",
  "mikacli sessions",
  "mikacli logs --status failed --since 1h",
  "mikacli jobs",
  'mikacli editor image resize ./photo.png --width 1200',
  'mikacli finance stocks AAPL',
  "mikacli google gmail labels",
  "mikacli google calendar today",
  "mikacli google docs documents",
  "mikacli google forms forms",
  'mikacli maps openstreetmap search "Mumbai"',
  'mikacli movie imdb search "inception"',
  'mikacli news top "AI"',
  'mikacli social x post "Launching MikaCLI"',
  'mikacli shopping amazon search "wireless mouse"',
  "mikacli developer github me",
  "mikacli devops cloudflare zones",
  'mikacli music spotify search "dandelions"',
  'mikacli bot telegrambot me',
  'mikacli tools translate "hello world" --to hi',
] as const;

export function createProgram(): Command {
  const program = new Command();

  program
    .name("mikacli")
    .description(
      "Automate platforms from the terminal using category-based commands for llm, editor, finance, data, google, maps, movie, news, music, social, shopping, developer, devops, bot, and tools.",
    )
    .version(packageJson.version, "-v, --version", "Show the installed version")
    .option("--json", "Emit machine-readable JSON output")
    .option("--verbose", "Enable verbose logging")
    .option("--select <fields>", "Select specific fields from results (comma-separated). Works with --json or --format")
    .option("--filter <expression>", "Filter results by expression (e.g. 'stars > 100 AND language = \"TypeScript\"'). Works with --json or --format")
    .option("--format <type>", "Output format: csv, table, yaml, markdown, html. Works with or without --json")
    .showHelpAfterError()
    .addHelpText("beforeAll", `${HELP_FRAME}\n`)
    .addHelpText(
      "after",
      `
Examples:
${ROOT_EXAMPLES.map((example) => `  ${example}`).join("\n")}

Filtering & Selection:
  mikacli developer github repos --json --select name,stargazers_count,language
  mikacli social x posts --json --filter 'public_metrics.like_count > 1000'
  mikacli developer github repos --json --select name,stars --filter 'stargazers_count > 100 AND language = "TypeScript"'

Format Transformations (with or without --json):
  mikacli developer github repos --json --format csv > repos.csv
  mikacli social reddit search "ai" --format table --filter 'score > 100'
  mikacli devops vercel projects --format yaml --select name,updated_at
`,
    )
    .addCommand(createLoginCommand())
    .addCommand(createLogoutCommand())
    .addCommand(createUpgradeCommand())
    .addCommand(createSearchCommand())
    .addCommand(createStatusCommand())
    .addCommand(createDoctorCommand())
    .addCommand(createSessionsCommand())
    .addCommand(createLogsCommand())
    .addCommand(createJobsCommand());

  for (const category of getPlatformCategories()) {
    const definitions = getPlatformDefinitionsByCategory(category);
    if (definitions.length > 0) {
      program.addCommand(buildCategoryCommand(category, definitions));
    }
  }

  return program;
}

export function assertCategoryOnlyInvocation(argv: readonly string[]): void {
  const suggestion = findLegacyDirectProviderInvocation(argv);
  if (!suggestion) {
    return;
  }

  throw new MikaCliError(
    "CATEGORY_COMMAND_REQUIRED",
    `Top-level provider commands are disabled. "${suggestion.command}" lives under "${suggestion.category}". Use "${suggestion.suggestedCommand}" instead.`,
    {
      details: {
        command: suggestion.command,
        category: suggestion.category,
        suggestedCommand: suggestion.suggestedCommand,
      },
    },
  );
}

function findLegacyDirectProviderInvocation(argv: readonly string[]): {
  command: string;
  category: string;
  isHelpRequest: boolean;
  suggestedCommand: string;
} | undefined {
  const positionals = argv.filter((token) => !token.startsWith("-"));
  if (positionals.length === 0) {
    return undefined;
  }

  const reserved = new Set<string>(["help", "login", "logout", "upgrade", "search", "status", "doctor", "sessions", "logs", "jobs", ...getPlatformCategories()]);
  const isHelpRequest = positionals[0] === "help";
  const candidate = isHelpRequest ? positionals[1] : positionals[0];
  if (!candidate || reserved.has(candidate)) {
    return undefined;
  }

  const definition = getPlatformDefinitions().find((entry) => entry.id === candidate || (entry.aliases ?? []).includes(candidate));
  if (!definition) {
    return undefined;
  }

  return {
    command: candidate,
    category: definition.category,
    isHelpRequest,
    suggestedCommand: buildSuggestedCategoryCommand(argv, definition.category, definition.id, candidate, isHelpRequest),
  };
}

function buildSuggestedCategoryCommand(
  argv: readonly string[],
  category: string,
  providerId: string,
  typedProvider: string,
  isHelpRequest: boolean,
): string {
  if (isHelpRequest) {
    const tail = argv.slice(1).filter((token, index) => !(index === 0 && token === typedProvider));
    return ["mikacli", category, providerId, ...tail, "--help"].join(" ").trim();
  }

  const providerIndex = argv.findIndex((token) => token === typedProvider);
  if (providerIndex < 0) {
    return `mikacli ${category} ${providerId}`;
  }

  return [
    "mikacli",
    ...argv.slice(0, providerIndex),
    category,
    providerId,
    ...argv.slice(providerIndex + 1),
  ].join(" ").trim();
}
