import { Command } from "commander";
import pc from "picocolors";

import packageJson from "../package.json" with { type: "json" };
import { createStatusCommand } from "./commands/status.js";
import { AutoCliError } from "./errors.js";
import { buildCategoryCommand } from "./core/runtime/build-category-command.js";
import { getPlatformCategories, getPlatformDefinitions, getPlatformDefinitionsByCategory } from "./platforms/index.js";

const HELP_FRAME = `${pc.bold(pc.cyan("AutoCLI"))}
${pc.dim("Terminal automation across LLMs, editors, maps, movies, socials, shopping, APIs, and public tools")}
`;

const ROOT_EXAMPLES = [
  'autocli llm chatgpt text "Hello my name is Justine"',
  'autocli editor image resize ./photo.png --width 1200',
  'autocli maps openstreetmap search "Mumbai"',
  'autocli movie imdb search "inception"',
  'autocli social x post "Launching AutoCLI"',
  'autocli shopping amazon search "wireless mouse"',
  "autocli api github me",
  'autocli music spotify search "dandelions"',
  'autocli public translate "hello world" --to hi',
] as const;

export function createProgram(): Command {
  const program = new Command();

  program
    .name("autocli")
    .description(
      "Automate platforms from the terminal using category-based commands for llm, editor, maps, movie, music, social, shopping, api, and public tools.",
    )
    .version(packageJson.version, "-v, --version", "Show the installed version")
    .option("--json", "Emit machine-readable JSON output")
    .option("--verbose", "Enable verbose logging")
    .showHelpAfterError()
    .addHelpText("beforeAll", `${HELP_FRAME}\n`)
    .addHelpText(
      "after",
      `
Examples:
${ROOT_EXAMPLES.map((example) => `  ${example}`).join("\n")}
`,
    )
    .addCommand(createStatusCommand());

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

  const helpSuffix = suggestion.isHelpRequest ? " --help" : " ...";
  throw new AutoCliError(
    "CATEGORY_COMMAND_REQUIRED",
    `Top-level provider commands are disabled. "${suggestion.command}" lives under "${suggestion.category}". Use "autocli ${suggestion.category} ${suggestion.command}${helpSuffix}" instead.`,
    {
      details: {
        command: suggestion.command,
        category: suggestion.category,
        suggestedCommand: `autocli ${suggestion.category} ${suggestion.command}${suggestion.isHelpRequest ? " --help" : ""}`,
      },
    },
  );
}

function findLegacyDirectProviderInvocation(argv: readonly string[]): {
  command: string;
  category: string;
  isHelpRequest: boolean;
} | undefined {
  const positionals = argv.filter((token) => !token.startsWith("-"));
  if (positionals.length === 0) {
    return undefined;
  }

  const reserved = new Set<string>(["help", "status", ...getPlatformCategories()]);
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
  };
}
