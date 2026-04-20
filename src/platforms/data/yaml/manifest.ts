import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDataActionResult } from "../shared/output.js";
import { yamlDataAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli data yaml format ./config.yaml",
  "mikacli data yaml to-json ./config.yaml --output ./config.json",
] as const;

function buildYamlCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("yaml").description("Format YAML and convert it to JSON");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("format")
    .description("Format YAML from a file, raw string, or '-' stdin")
    .argument("<source>", "YAML file path, raw YAML string, or '-' for stdin")
    .option("--indent <spaces>", "Indent width from 1-8", (value) => Number.parseInt(value, 10), 2)
    .option("--output <path>", "Write the formatted YAML to a file")
    .action(async (source: string, input: { indent?: number; output?: string }, cmd: Command) => {
      await runYamlAction(cmd, "Formatting YAML...", "YAML formatted.", () =>
        yamlDataAdapter.format({
          source,
          indent: input.indent,
          output: input.output,
        }),
      );
    });

  command
    .command("to-json")
    .description("Convert YAML into JSON")
    .argument("<source>", "YAML file path, raw YAML string, or '-' for stdin")
    .option("--indent <spaces>", "Indent width from 0-8", (value) => Number.parseInt(value, 10), 2)
    .option("--output <path>", "Write the JSON output to a file")
    .action(async (source: string, input: { indent?: number; output?: string }, cmd: Command) => {
      await runYamlAction(cmd, "Converting YAML...", "YAML converted to JSON.", () =>
        yamlDataAdapter.toJson({
          source,
          indent: input.indent,
          output: input.output,
        }),
      );
    });

  return command;
}

async function runYamlAction(cmd: Command, loadingText: string, successMessage: string, action: () => Promise<AdapterActionResult>) {
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

export const yamlPlatformDefinition: PlatformDefinition = {
  id: "yaml" as PlatformDefinition["id"],
  category: "data",
  displayName: "YAML",
  description: "Format YAML and convert it to JSON",
  authStrategies: ["none"],
  buildCommand: buildYamlCommand,
  adapter: yamlDataAdapter,
  examples: EXAMPLES,
};
