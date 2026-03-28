import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDataActionResult } from "../shared/output.js";
import { markdownDataAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli data markdown to-html ./notes.md",
  "autocli data markdown text ./notes.md --output ./notes.txt",
] as const;

function buildMarkdownCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("markdown").description("Transform Markdown into HTML or plain text");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("to-html")
    .description("Convert Markdown into HTML")
    .argument("<source>", "Markdown file path, raw Markdown string, or '-' for stdin")
    .option("--output <path>", "Write the HTML result to a file")
    .action(async (source: string, input: { output?: string }, cmd: Command) => {
      await runMarkdownAction(cmd, "Converting Markdown...", "Markdown converted to HTML.", () =>
        markdownDataAdapter.toHtml({
          source,
          output: input.output,
        }),
      );
    });

  command
    .command("text")
    .description("Convert Markdown into plain text")
    .argument("<source>", "Markdown file path, raw Markdown string, or '-' for stdin")
    .option("--output <path>", "Write the plain-text result to a file")
    .action(async (source: string, input: { output?: string }, cmd: Command) => {
      await runMarkdownAction(cmd, "Extracting Markdown text...", "Markdown converted to text.", () =>
        markdownDataAdapter.text({
          source,
          output: input.output,
        }),
      );
    });

  return command;
}

async function runMarkdownAction(cmd: Command, loadingText: string, successMessage: string, action: () => Promise<AdapterActionResult>) {
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

export const markdownPlatformDefinition: PlatformDefinition = {
  id: "markdown" as PlatformDefinition["id"],
  category: "data",
  displayName: "Markdown",
  description: "Transform Markdown into HTML or plain text",
  authStrategies: ["none"],
  buildCommand: buildMarkdownCommand,
  adapter: markdownDataAdapter,
  examples: EXAMPLES,
};
