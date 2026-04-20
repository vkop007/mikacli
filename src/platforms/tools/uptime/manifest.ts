import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { uptimeAdapter } from "./adapter.js";
import { printUptimeResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli uptime https://example.com",
  "mikacli uptime openai.com",
  "mikacli uptime https://example.com --method GET --timeout 15000",
] as const;

function buildUptimeCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("uptime").description("Check website uptime, latency, and HTTP status");
  command.argument("<target>", "Website URL or hostname");
  command.option("--method <method>", "HTTP method to use: HEAD or GET", "HEAD");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 10000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string, input: { method?: string; timeout: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Checking uptime...");

    await runCommandAction({
      spinner,
      successMessage: "Uptime check complete.",
      action: () =>
        uptimeAdapter.uptime({
          target,
          method: input.method,
          timeoutMs: input.timeout,
        }),
      onSuccess: (result) => printUptimeResult(result, ctx.json),
    });
  });

  return command;
}

export const uptimePlatformDefinition: PlatformDefinition = {
  id: "uptime",
  category: "tools",
  displayName: "Uptime",
  description: "Check whether a website is reachable and how quickly it responds",
  authStrategies: ["none"],
  buildCommand: buildUptimeCommand,
  adapter: uptimeAdapter,
  examples: EXAMPLES,
};
