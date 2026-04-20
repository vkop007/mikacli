import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDataActionResult } from "../shared/output.js";
import { jsonDataAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli data json format ./payload.json",
  "mikacli data json query ./payload.json data.items[0].title",
  "mikacli data json merge ./base.json ./override.json --sort-keys",
  "mikacli data json format '{\"ok\":true}' --json",
] as const;

function buildJsonCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("json").description("Format, query, and merge JSON for agent workflows");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("format")
    .description("Format JSON from a file, raw string, or '-' stdin")
    .argument("<source>", "JSON file path, raw JSON string, or '-' for stdin")
    .option("--indent <spaces>", "Indent width from 0-8", (value) => Number.parseInt(value, 10), 2)
    .option("--sort-keys", "Sort object keys recursively")
    .option("--output <path>", "Write the formatted result to a file")
    .action(async (source: string, input: { indent?: number; sortKeys?: boolean; output?: string }, cmd: Command) => {
      await runJsonAction(cmd, "Formatting JSON...", "JSON formatted.", () =>
        jsonDataAdapter.format({
          source,
          indent: input.indent,
          sortKeys: input.sortKeys,
          output: input.output,
        }),
      );
    });

  command
    .command("query")
    .description("Resolve a JSON path like data.items[0].title")
    .argument("<source>", "JSON file path, raw JSON string, or '-' for stdin")
    .argument("<path>", "JSON path")
    .option("--output <path>", "Write the resolved value to a file")
    .action(async (source: string, path: string, input: { output?: string }, cmd: Command) => {
      await runJsonAction(cmd, "Querying JSON...", "JSON query completed.", () =>
        jsonDataAdapter.query({
          source,
          path,
          output: input.output,
        }),
      );
    });

  command
    .command("merge")
    .description("Merge multiple JSON documents deeply; later inputs override earlier keys")
    .argument("<sources...>", "Two or more JSON file paths, raw strings, or '-' stdin")
    .option("--indent <spaces>", "Indent width from 0-8", (value) => Number.parseInt(value, 10), 2)
    .option("--sort-keys", "Sort object keys recursively")
    .option("--output <path>", "Write the merged result to a file")
    .action(async (sources: string[], input: { indent?: number; sortKeys?: boolean; output?: string }, cmd: Command) => {
      await runJsonAction(cmd, "Merging JSON...", "JSON merged.", () =>
        jsonDataAdapter.merge({
          sources,
          indent: input.indent,
          sortKeys: input.sortKeys,
          output: input.output,
        }),
      );
    });

  return command;
}

async function runJsonAction(cmd: Command, loadingText: string, successMessage: string, action: () => Promise<AdapterActionResult>) {
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

export const jsonPlatformDefinition: PlatformDefinition = {
  id: "json" as PlatformDefinition["id"],
  category: "data",
  displayName: "JSON",
  description: "Format, query, and merge JSON without leaving the terminal",
  authStrategies: ["none"],
  buildCommand: buildJsonCommand,
  adapter: jsonDataAdapter,
  examples: EXAMPLES,
};
