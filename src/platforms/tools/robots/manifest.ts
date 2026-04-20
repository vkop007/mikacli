import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { robotsAdapter } from "./adapter.js";
import { robotsCapabilities } from "./capabilities/index.js";
import { printRobotsResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = ["mikacli robots https://example.com", "mikacli robots https://example.com/robots.txt"] as const;

function buildRobotsCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("robots").description("Fetch and parse a robots.txt file");
  command.argument("<url>", "Site URL or robots.txt URL");
  command.option("--follow-sitemaps", "Return sitemap directives in the parsed data");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (url: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading robots.txt...");

    await runCommandAction({
      spinner,
      successMessage: "robots.txt loaded.",
      action: () =>
        robotsAdapter.inspect({
          url,
          followSitemaps: Boolean(options.followSitemaps),
        }),
      onSuccess: (result) => printRobotsResult(result, ctx.json),
    });
  });

  return command;
}

export const robotsPlatformDefinition: PlatformDefinition = {
  id: "robots" as unknown as PlatformDefinition["id"],
  category: "tools",
  displayName: "Robots",
  description: "Fetch and parse robots.txt files without any account setup",
  authStrategies: ["none"],
  buildCommand: buildRobotsCommand,
  adapter: robotsAdapter,
  capabilities: robotsCapabilities,
  examples: EXAMPLES,
};
