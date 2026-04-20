import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { faviconAdapter } from "./adapter.js";
import { printFaviconResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli favicon https://example.com",
  "mikacli favicon openai.com",
  "mikacli favicon https://example.com --json",
] as const;

function buildFaviconCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("favicon").description("Resolve and verify favicon candidates for a public webpage");
  command.argument("<target>", "Website URL or hostname");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string, input: { timeout: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading favicon candidates...");

    await runCommandAction({
      spinner,
      successMessage: "Favicon candidates loaded.",
      action: () =>
        faviconAdapter.inspect({
          target,
          timeoutMs: input.timeout,
        }),
      onSuccess: (result) => printFaviconResult(result, ctx.json),
    });
  });

  return command;
}

export const faviconPlatformDefinition: PlatformDefinition = {
  id: "favicon" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Favicon",
  description: "Find and verify favicon candidates for a public webpage",
  authStrategies: ["none"],
  buildCommand: buildFaviconCommand,
  adapter: faviconAdapter,
  examples: EXAMPLES,
};
