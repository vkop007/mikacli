import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { pageLinksAdapter } from "./adapter.js";
import { printPageLinksResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli page-links https://example.com",
  "mikacli page-links openai.com --type external",
  "mikacli page-links https://example.com --limit 20 --json",
] as const;

function buildPageLinksCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("page-links").description("Extract normalized internal and external links from a public webpage");
  command.argument("<target>", "Website URL or hostname");
  command.option("--type <type>", "Link type to return: all, internal, or external", "all");
  command.option("--limit <number>", "Maximum links to return (default: 100)", (value) => Number.parseInt(value, 10), 100);
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (target: string, input: { type?: string; limit: number; timeout: number }, cmd: Command) => {
    const ctx = resolveCommandContext(cmd);
    const logger = new Logger(ctx);
    const spinner = logger.spinner("Loading page links...");

    await runCommandAction({
      spinner,
      successMessage: "Page links loaded.",
      action: () =>
        pageLinksAdapter.inspect({
          target,
          timeoutMs: input.timeout,
          type: input.type as "all" | "internal" | "external" | undefined,
          limit: input.limit,
        }),
      onSuccess: (result) => printPageLinksResult(result, ctx.json),
    });
  });

  return command;
}

export const pageLinksPlatformDefinition: PlatformDefinition = {
  id: "page-links" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Page Links",
  description: "Extract normalized internal and external links from a public webpage",
  authStrategies: ["none"],
  buildCommand: buildPageLinksCommand,
  adapter: pageLinksAdapter,
  examples: EXAMPLES,
};
