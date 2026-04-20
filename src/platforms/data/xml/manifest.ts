import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDataActionResult } from "../shared/output.js";
import { xmlDataAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli data xml format ./feed.xml",
  "mikacli data xml to-json ./feed.xml --output ./feed.json",
] as const;

function buildXmlCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("xml").description("Format XML and convert it to JSON");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("format")
    .description("Format XML from a file, raw string, or '-' stdin")
    .argument("<source>", "XML file path, raw XML string, or '-' for stdin")
    .option("--indent <spaces>", "Indent width from 1-8", (value) => Number.parseInt(value, 10), 2)
    .option("--output <path>", "Write the formatted XML to a file")
    .action(async (source: string, input: { indent?: number; output?: string }, cmd: Command) => {
      await runXmlAction(cmd, "Formatting XML...", "XML formatted.", () =>
        xmlDataAdapter.format({
          source,
          indent: input.indent,
          output: input.output,
        }),
      );
    });

  command
    .command("to-json")
    .description("Convert XML into JSON")
    .argument("<source>", "XML file path, raw XML string, or '-' for stdin")
    .option("--indent <spaces>", "Indent width from 0-8", (value) => Number.parseInt(value, 10), 2)
    .option("--output <path>", "Write the JSON output to a file")
    .action(async (source: string, input: { indent?: number; output?: string }, cmd: Command) => {
      await runXmlAction(cmd, "Converting XML...", "XML converted to JSON.", () =>
        xmlDataAdapter.toJson({
          source,
          indent: input.indent,
          output: input.output,
        }),
      );
    });

  return command;
}

async function runXmlAction(cmd: Command, loadingText: string, successMessage: string, action: () => Promise<AdapterActionResult>) {
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

export const xmlPlatformDefinition: PlatformDefinition = {
  id: "xml" as PlatformDefinition["id"],
  category: "data",
  displayName: "XML",
  description: "Format XML and convert it to JSON",
  authStrategies: ["none"],
  buildCommand: buildXmlCommand,
  adapter: xmlDataAdapter,
  examples: EXAMPLES,
};
