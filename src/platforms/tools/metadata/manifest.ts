import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { metadataAdapter } from "./adapter.js";
import { printMetadataResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli metadata https://example.com",
  "mikacli metadata openai.com",
  "mikacli metadata https://example.com --json",
] as const;

function buildMetadataCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("metadata").description("Extract title, description, canonical, and social metadata from a webpage");
  command.argument("<target>", "Website URL or hostname");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string, input: { timeout: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading page metadata...");

    await runCommandAction({
      spinner,
      successMessage: "Page metadata loaded.",
      action: () =>
        metadataAdapter.inspect({
          target,
          timeoutMs: input.timeout,
        }),
      onSuccess: (result) => printMetadataResult(result, ctx.json),
    });
  });

  return command;
}

export const metadataPlatformDefinition: PlatformDefinition = {
  id: "metadata" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Metadata",
  description: "Extract HTML metadata from a public webpage with no API key",
  authStrategies: ["none"],
  buildCommand: buildMetadataCommand,
  adapter: metadataAdapter,
  examples: EXAMPLES,
};
