import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printDataActionResult } from "../shared/output.js";
import { textDataAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli data text stats ./notes.txt",
  "autocli data text replace ./notes.txt --find draft --replace final",
  "autocli data text dedupe-lines ./list.txt --output ./list.cleaned.txt",
] as const;

function buildTextCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("text").description("Analyze and transform plain text");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("stats")
    .description("Count characters, words, and lines")
    .argument("<source>", "Text file path, raw text string, or '-' for stdin")
    .action(async (source: string, _input: Record<string, never>, cmd: Command) => {
      await runTextAction(cmd, "Measuring text...", "Text stats ready.", () => textDataAdapter.stats({ source }));
    });

  command
    .command("replace")
    .description("Replace text or regex matches")
    .argument("<source>", "Text file path, raw text string, or '-' for stdin")
    .requiredOption("--find <value>", "Text or regex pattern to replace")
    .requiredOption("--replace <value>", "Replacement text")
    .option("--regex", "Treat --find as a regular expression")
    .option("--flags <value>", "Regex flags, defaults to g")
    .option("--output <path>", "Write the result to a file")
    .action(
      async (
        source: string,
        input: { find: string; replace: string; regex?: boolean; flags?: string; output?: string },
        cmd: Command,
      ) => {
        await runTextAction(cmd, "Replacing text...", "Text replaced.", () =>
          textDataAdapter.replace({
            source,
            find: input.find,
            replace: input.replace,
            regex: input.regex,
            flags: input.flags,
            output: input.output,
          }),
        );
      },
    );

  command
    .command("dedupe-lines")
    .description("Remove duplicate lines while preserving the first occurrence")
    .argument("<source>", "Text file path, raw text string, or '-' for stdin")
    .option("--ignore-case", "Treat lines with different case as duplicates")
    .option("--output <path>", "Write the cleaned text to a file")
    .action(async (source: string, input: { ignoreCase?: boolean; output?: string }, cmd: Command) => {
      await runTextAction(cmd, "Deduplicating lines...", "Duplicate lines removed.", () =>
        textDataAdapter.dedupe({
          source,
          ignoreCase: input.ignoreCase,
          output: input.output,
        }),
      );
    });

  return command;
}

async function runTextAction(cmd: Command, loadingText: string, successMessage: string, action: () => Promise<AdapterActionResult>) {
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

export const textPlatformDefinition: PlatformDefinition = {
  id: "text" as PlatformDefinition["id"],
  category: "data",
  displayName: "Text",
  description: "Analyze and transform plain text",
  authStrategies: ["none"],
  buildCommand: buildTextCommand,
  adapter: textDataAdapter,
  examples: EXAMPLES,
};
