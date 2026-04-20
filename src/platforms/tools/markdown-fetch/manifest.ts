import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { markdownFetchAdapter } from "./adapter.js";
import { markdownFetchCapabilities } from "./capabilities/index.js";
import { printMarkdownFetchResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli markdown-fetch https://example.com",
  "mikacli markdown-fetch https://news.ycombinator.com --include-links",
  "mikacli markdown-fetch https://example.com/article --max-chars 12000",
] as const;

function buildMarkdownFetchCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("markdown-fetch").description("Fetch a web page and convert it into readable markdown");
  command.argument("<url>", "Web page URL");
  command.option("--max-chars <number>", "Maximum markdown characters to keep (default: 6000)", parsePositiveInteger, 6000);
  command.option("--include-links", "Preserve inline links in markdown output");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (url: string, options: Record<string, unknown>, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading page...");

    await runCommandAction({
      spinner,
      successMessage: "Page loaded.",
      action: () =>
        markdownFetchAdapter.fetch({
          url,
          maxChars: options.maxChars as number | undefined,
          includeLinks: Boolean(options.includeLinks),
        }),
      onSuccess: (result) => printMarkdownFetchResult(result, ctx.json),
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

export const markdownFetchPlatformDefinition: PlatformDefinition = {
  id: "markdown-fetch" as unknown as PlatformDefinition["id"],
  category: "tools",
  displayName: "Markdown Fetch",
  description: "Fetch a web page and convert it to readable markdown without any account setup",
  authStrategies: ["none"],
  buildCommand: buildMarkdownFetchCommand,
  adapter: markdownFetchAdapter,
  capabilities: markdownFetchCapabilities,
  examples: EXAMPLES,
};
