import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { sitemapAdapter } from "./adapter.js";
import { sitemapCapabilities } from "./capabilities/index.js";
import { printSitemapResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli sitemap https://example.com/sitemap.xml",
  "mikacli sitemap https://example.com --limit 250",
  "mikacli sitemap https://example.com --depth 2",
] as const;

function buildSitemapCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("sitemap").description("Fetch and parse a sitemap.xml or sitemap index");
  command.argument("<url>", "Sitemap URL or site URL");
  command.option("--limit <number>", "Maximum number of URLs to return (default: 100)", parsePositiveInteger, 100);
  command.option("--depth <number>", "How many sitemap index levels to follow (default: 1)", parsePositiveInteger, 1);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (url: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading sitemap...");

    await runCommandAction({
      spinner,
      successMessage: "Sitemap loaded.",
      action: () =>
        sitemapAdapter.fetch({
          url,
          limit: options.limit as number | undefined,
          depth: options.depth as number | undefined,
        }),
      onSuccess: (result) => printSitemapResult(result, ctx.json),
    });
  });

  return command;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer "${value}".`);
  }

  return parsed;
}

export const sitemapPlatformDefinition: PlatformDefinition = {
  id: "sitemap" as unknown as PlatformDefinition["id"],
  category: "tools",
  displayName: "Sitemap",
  description: "Fetch and parse sitemap.xml files without any account setup",
  authStrategies: ["none"],
  buildCommand: buildSitemapCommand,
  adapter: sitemapAdapter,
  capabilities: sitemapCapabilities,
  examples: EXAMPLES,
};
