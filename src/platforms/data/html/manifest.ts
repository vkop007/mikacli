import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDataActionResult } from "../shared/output.js";
import { htmlDataAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli data html text ./page.html",
  "autocli data html to-markdown ./page.html --output ./page.md",
] as const;

function buildHtmlCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("html").description("Transform HTML into plain text or Markdown");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("text")
    .description("Extract plain text from HTML")
    .argument("<source>", "HTML file path, raw HTML string, or '-' for stdin")
    .option("--output <path>", "Write the plain-text result to a file")
    .action(async (source: string, input: { output?: string }, cmd: Command) => {
      await runHtmlAction(cmd, "Extracting HTML text...", "HTML converted to text.", () =>
        htmlDataAdapter.text({
          source,
          output: input.output,
        }),
      );
    });

  command
    .command("to-markdown")
    .description("Convert HTML into Markdown")
    .argument("<source>", "HTML file path, raw HTML string, or '-' for stdin")
    .option("--output <path>", "Write the Markdown result to a file")
    .action(async (source: string, input: { output?: string }, cmd: Command) => {
      await runHtmlAction(cmd, "Converting HTML...", "HTML converted to Markdown.", () =>
        htmlDataAdapter.toMarkdown({
          source,
          output: input.output,
        }),
      );
    });

  return command;
}

async function runHtmlAction(cmd: Command, loadingText: string, successMessage: string, action: () => Promise<AdapterActionResult>) {
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

export const htmlPlatformDefinition: PlatformDefinition = {
  id: "html" as PlatformDefinition["id"],
  category: "data",
  displayName: "HTML",
  description: "Transform HTML into plain text or Markdown",
  authStrategies: ["none"],
  buildCommand: buildHtmlCommand,
  adapter: htmlDataAdapter,
  examples: EXAMPLES,
};
