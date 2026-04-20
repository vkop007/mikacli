import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { sslAdapter } from "./adapter.js";
import { printSslResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli ssl https://example.com",
  "mikacli ssl openai.com",
  "mikacli ssl https://example.com --json",
] as const;

function buildSslCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("ssl").description("Inspect TLS certificate details for a public HTTPS host");
  command.argument("<target>", "Website URL or hostname");
  command.option("--timeout <ms>", "TLS connection timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string, input: { timeout: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Inspecting TLS certificate...");

    await runCommandAction({
      spinner,
      successMessage: "TLS certificate loaded.",
      action: () =>
        sslAdapter.inspect({
          target,
          timeoutMs: input.timeout,
        }),
      onSuccess: (result) => printSslResult(result, ctx.json),
    });
  });

  return command;
}

export const sslPlatformDefinition: PlatformDefinition = {
  id: "ssl" as PlatformDefinition["id"],
  category: "tools",
  displayName: "SSL",
  description: "Inspect TLS certificate and protocol details without any API key",
  authStrategies: ["none"],
  buildCommand: buildSslCommand,
  adapter: sslAdapter,
  examples: EXAMPLES,
};
