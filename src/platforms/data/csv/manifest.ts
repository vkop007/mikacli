import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDataActionResult } from "../shared/output.js";
import { csvDataAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli data csv info ./users.csv",
  "autocli data csv to-json ./orders.csv --output ./orders.json",
  "autocli data csv filter ./orders.csv --where 'status=paid'",
  "autocli data csv filter ./orders.csv --where 'amount>100' --as json --json",
] as const;

function buildCsvCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("csv").description("Inspect and transform CSV for agent-friendly workflows");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect CSV columns, row count, and a small preview")
    .argument("<source>", "CSV file path, raw CSV string, or '-' for stdin")
    .action(async (source: string, _input: Record<string, never>, cmd: Command) => {
      await runCsvAction(cmd, "Inspecting CSV...", "CSV inspected.", () => csvDataAdapter.info({ source }));
    });

  command
    .command("to-json")
    .description("Convert CSV into a JSON array")
    .argument("<source>", "CSV file path, raw CSV string, or '-' for stdin")
    .option("--indent <spaces>", "Indent width from 0-8", (value) => Number.parseInt(value, 10), 2)
    .option("--output <path>", "Write the JSON output to a file")
    .action(async (source: string, input: { indent?: number; output?: string }, cmd: Command) => {
      await runCsvAction(cmd, "Converting CSV...", "CSV converted to JSON.", () =>
        csvDataAdapter.toJson({
          source,
          indent: input.indent,
          output: input.output,
        }),
      );
    });

  command
    .command("filter")
    .description("Filter CSV rows with expressions like status=done or amount>10")
    .argument("<source>", "CSV file path, raw CSV string, or '-' for stdin")
    .requiredOption("--where <expression>", "Filter expression like status=paid or amount>100")
    .option("--as <format>", "Output format: csv or json", "csv")
    .option("--output <path>", "Write the filtered result to a file")
    .action(async (source: string, input: { where: string; as?: string; output?: string }, cmd: Command) => {
      await runCsvAction(cmd, "Filtering CSV...", "CSV filtered.", () =>
        csvDataAdapter.filter({
          source,
          where: input.where,
          format: input.as === "json" ? "json" : "csv",
          output: input.output,
        }),
      );
    });

  return command;
}

async function runCsvAction(cmd: Command, loadingText: string, successMessage: string, action: () => Promise<AdapterActionResult>) {
  const ctx = resolveCommandContext(cmd);
  const logger = new Logger(ctx);
  const spinner = logger.spinner(loadingText);

  await runCommandAction({
    spinner,
    successMessage,
    action,
    onSuccess: (result) => printDataActionResult(result, ctx.json),
  });
}

export const csvPlatformDefinition: PlatformDefinition = {
  id: "csv" as PlatformDefinition["id"],
  category: "data",
  displayName: "CSV",
  description: "Inspect, filter, and convert CSV without leaving the terminal",
  authStrategies: ["none"],
  buildCommand: buildCsvCommand,
  adapter: csvDataAdapter,
  examples: EXAMPLES,
};
