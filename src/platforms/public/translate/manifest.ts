import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { translateAdapter } from "./adapter.js";
import { translateCapabilities } from "./capabilities/index.js";
import { printTranslateResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";
import type { PlatformName } from "../../config.js";

const EXAMPLES = [
  'autocli translate "hello world"',
  'autocli translate "hello world" --to hi',
  'autocli translate "good morning" --from en --to es',
] as const;

function buildTranslateCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("translate").description("Translate text using Google's public no-key translation endpoint");
  command.argument("<text...>", "Text to translate");
  command.option("--from <lang>", "Source language code or auto/detect", "auto");
  command.option("--to <lang>", "Target language code", "en");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (text: string[] | string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Translating text...");

    await runCommandAction({
      spinner,
      successMessage: "Translation loaded.",
      action: () =>
        translateAdapter.translate({
          text: Array.isArray(text) ? text.join(" ") : String(text ?? ""),
          from: options.from as string | undefined,
          to: options.to as string | undefined,
        }),
      onSuccess: (result) => printTranslateResult(result, ctx.json),
    });
  });

  return command;
}

export const translatePlatformDefinition: PlatformDefinition = {
  id: "translate" as PlatformName,
  category: "public",
  displayName: "Translate",
  description: "Translate text from the terminal using a no-key public endpoint",
  authStrategies: ["none"],
  buildCommand: buildTranslateCommand,
  adapter: translateAdapter,
  capabilities: translateCapabilities,
  examples: EXAMPLES,
};
