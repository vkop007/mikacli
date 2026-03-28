import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { oEmbedAdapter } from "./adapter.js";
import { printOEmbedResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "autocli oembed https://vimeo.com/76979871 --format json",
  "autocli oembed https://www.flickr.com/photos/bees/2341623661 --json",
] as const;

function buildOEmbedCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("oembed").description("Resolve oEmbed metadata from a public URL");
  command.argument("<target>", "Embeddable page URL");
  command.option("--format <format>", "Preferred response format: auto, json, or xml", "auto");
  command.option("--maxwidth <number>", "Optional max embed width", (value) => Number.parseInt(value, 10));
  command.option("--maxheight <number>", "Optional max embed height", (value) => Number.parseInt(value, 10));
  command.option("--discover-only", "Use only page-discovered oEmbed endpoints, without public fallback");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(
    async (
      target: string,
      input: { format?: string; maxwidth?: number; maxheight?: number; discoverOnly?: boolean; timeout: number },
      cmd: Command,
    ) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading oEmbed metadata...");

      await runCommandAction({
        spinner,
        successMessage: "oEmbed metadata loaded.",
        action: () =>
          oEmbedAdapter.inspect({
            target,
            format: input.format as "auto" | "json" | "xml" | undefined,
            maxWidth: input.maxwidth,
            maxHeight: input.maxheight,
            discoverOnly: Boolean(input.discoverOnly),
            timeoutMs: input.timeout,
          }),
        onSuccess: (result) => printOEmbedResult(result, ctx.json),
      });
    },
  );

  return command;
}

export const oEmbedPlatformDefinition: PlatformDefinition = {
  id: "oembed" as PlatformDefinition["id"],
  category: "tools",
  displayName: "oEmbed",
  description: "Resolve embeddable media/page metadata from public URLs",
  authStrategies: ["none"],
  buildCommand: buildOEmbedCommand,
  adapter: oEmbedAdapter,
  examples: EXAMPLES,
};
