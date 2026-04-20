import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { transcriptAdapter } from "./adapter.js";
import { printTranscriptResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "mikacli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --lang en --format srt",
  "mikacli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --auto --format json --json",
] as const;

function buildTranscriptCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("transcript").description("Extract subtitles or transcripts from media URLs using yt-dlp");
  command.argument("<target>", "Media page URL");
  command.option("--lang <code>", "Preferred subtitle language code, for example en, hi, or es");
  command.option("--auto", "Prefer auto-generated captions when available");
  command.option("--format <format>", "Output format: txt, vtt, srt, or json", "txt");
  command.option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 15000);
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(
    async (
      target: string,
      input: { lang?: string; auto?: boolean; format?: string; timeout: number },
      cmd: Command,
    ) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading transcript...");

      await runCommandAction({
        spinner,
        successMessage: "Transcript loaded.",
        action: () =>
          transcriptAdapter.fetch({
            target,
            lang: input.lang,
            auto: Boolean(input.auto),
            format: input.format,
            timeoutMs: input.timeout,
          }),
        onSuccess: (result) => printTranscriptResult(result, ctx.json),
      });
    },
  );

  return command;
}

export const transcriptPlatformDefinition: PlatformDefinition = {
  id: "transcript" as PlatformDefinition["id"],
  category: "tools",
  displayName: "Transcript",
  description: "Extract subtitles or transcripts from media URLs via yt-dlp",
  authStrategies: ["none"],
  buildCommand: buildTranscriptCommand,
  adapter: transcriptAdapter,
  examples: EXAMPLES,
};
