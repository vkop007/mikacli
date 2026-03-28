import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { cheatAdapter } from "./adapter.js";
import { cheatCapabilities } from "./capabilities/index.js";
import { printCheatResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli cheat git status",
  "autocli cheat --shell bash reverse list",
  "autocli cheat --lang python list comprehension",
] as const;

function buildCheatCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("cheat").description("Look up quick cheat sheet snippets from cht.sh");
  command.alias("cht");
  command.argument("<topic...>", "Topic to look up");
  command.option("--shell <bash|zsh|fish|powershell>", "Optional shell context for the lookup");
  command.option("--lang <lang>", "Optional language or context prefix");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (topic: string[] | string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading cheat sheet...");

    await runCommandAction({
      spinner,
      successMessage: "Cheat sheet loaded.",
      action: () =>
        cheatAdapter.cheat({
          topic: Array.isArray(topic) ? topic.join(" ") : String(topic ?? ""),
          shell: options.shell as string | undefined,
          lang: options.lang as string | undefined,
        }),
      onSuccess: (result) => printCheatResult(result, ctx.json),
    });
  });

  return command;
}

export const cheatPlatformDefinition: PlatformDefinition = {
  id: "cheat",
  category: "tools",
  displayName: "Cheat",
  description: "Look up quick cheat sheet snippets from cht.sh without any account setup",
  aliases: ["cht"],
  authStrategies: ["none"],
  buildCommand: buildCheatCommand,
  adapter: cheatAdapter,
  capabilities: cheatCapabilities,
  examples: EXAMPLES,
};
