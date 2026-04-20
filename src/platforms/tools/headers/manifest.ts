import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { headersAdapter } from "./adapter.js";
import { printHeadersResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli headers https://example.com",
  "mikacli headers openai.com --method GET",
  "mikacli headers https://example.com --json",
] as const;

function buildHeadersCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("headers").description("Inspect HTTP response headers for a public URL");
  command.argument("<target>", "Website URL or hostname");
  command.option("--method <method>", "HTTP method to use: HEAD or GET", "HEAD");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 10000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string, input: { method?: string; timeout: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading headers...");

    await runCommandAction({
      spinner,
      successMessage: "Headers loaded.",
      action: () =>
        headersAdapter.inspect({
          target,
          method: input.method,
          timeoutMs: input.timeout,
        }),
      onSuccess: (result) => printHeadersResult(result, ctx.json),
    });
  });

  return command;
}

export const headersPlatformDefinition: PlatformDefinition = {
  id: "headers" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Headers",
  description: "Inspect HTTP response headers without any API key",
  authStrategies: ["none"],
  buildCommand: buildHeadersCommand,
  adapter: headersAdapter,
  examples: EXAMPLES,
};
