import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { rssAdapter } from "./adapter.js";
import { rssCapabilities } from "./capabilities/index.js";
import { printRssResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli rss https://hnrss.org/frontpage",
  "autocli rss https://example.com/feed.xml --limit 5",
  "autocli rss https://example.com/feed.xml --summary --summary-limit 2",
] as const;

function buildRssCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("rss").description("Fetch and parse an RSS or Atom feed URL");
  command.argument("<feedUrl>", "RSS or Atom feed URL");
  command.option("--limit <number>", "Maximum number of feed items to load (default: 10)", parsePositiveInteger, 10);
  command.option("--summary", "Fetch article summaries for the first items when available");
  command.option("--summary-limit <number>", "Maximum items to summarize (default: 3)", parsePositiveInteger, 3);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (feedUrl: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading RSS feed...");

    await runCommandAction({
      spinner,
      successMessage: "RSS feed loaded.",
      action: () =>
        rssAdapter.fetch({
          feedUrl,
          limit: options.limit as number | undefined,
          summary: Boolean(options.summary),
          summaryLimit: options.summaryLimit as number | undefined,
        }),
      onSuccess: (result) => printRssResult(result, ctx.json),
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

export const rssPlatformDefinition: PlatformDefinition = {
  id: "rss" as unknown as PlatformDefinition["id"],
  category: "public",
  displayName: "RSS",
  description: "Fetch and parse RSS or Atom feeds without any account setup",
  authStrategies: ["none"],
  buildCommand: buildRssCommand,
  adapter: rssAdapter,
  capabilities: rssCapabilities,
  examples: EXAMPLES,
};
