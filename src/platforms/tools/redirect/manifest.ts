import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { redirectAdapter } from "./adapter.js";
import { printRedirectResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli redirect https://example.com",
  "mikacli redirect github.com --method GET",
  "mikacli redirect https://example.com --max-hops 5",
] as const;

function buildRedirectCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("redirect").description("Trace the HTTP redirect chain for a public URL");
  command.argument("<target>", "Website URL or hostname");
  command.option("--method <method>", "HTTP method to use: HEAD or GET", "HEAD");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.option("--max-hops <number>", "Maximum redirect hops to follow", (value) => Number.parseInt(value, 10), 10);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string, input: { method?: string; timeout: number; maxHops: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Tracing redirects...");

    await runCommandAction({
      spinner,
      successMessage: "Redirect chain loaded.",
      action: () =>
        redirectAdapter.trace({
          target,
          method: input.method,
          timeoutMs: input.timeout,
          maxHops: input.maxHops,
        }),
      onSuccess: (result) => printRedirectResult(result, ctx.json),
    });
  });

  return command;
}

export const redirectPlatformDefinition: PlatformDefinition = {
  id: "redirect" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Redirect",
  description: "Trace public HTTP redirect chains without any API key",
  authStrategies: ["none"],
  buildCommand: buildRedirectCommand,
  adapter: redirectAdapter,
  examples: EXAMPLES,
};
