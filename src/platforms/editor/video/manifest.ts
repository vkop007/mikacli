import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { videoEditorAdapter } from "./adapter.js";
import { printVideoEditorResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli video info ./clip.mp4",
  "autocli video trim ./clip.mp4 --start 00:00:05 --duration 10",
  "autocli video convert ./clip.mov --to mp4",
  "autocli video compress ./clip.mp4 --crf 28",
  "autocli video thumbnail ./clip.mp4 --at 00:00:03",
] as const;

function buildVideoEditorCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("video").description("Edit local video files using ffmpeg");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a local video file")
    .argument("<inputPath>", "Input video path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading video info...");
      await runCommandAction({
        spinner,
        successMessage: "Video info loaded.",
        action: () => videoEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("trim")
    .description("Trim a local video file")
    .argument("<inputPath>", "Input video path")
    .option("--start <time>", "Trim start time, e.g. 00:00:05")
    .option("--end <time>", "Trim end time, e.g. 00:00:20")
    .option("--duration <time>", "Trim duration, e.g. 10 or 00:00:10")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { start?: string; end?: string; duration?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Trimming video...");
        await runCommandAction({
          spinner,
          successMessage: "Video trimmed.",
          action: () =>
            videoEditorAdapter.trim({
              inputPath,
              start: input.start,
              end: input.end,
              duration: input.duration,
              output: input.output,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("convert")
    .description("Convert a local video to another format")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--to <format>", "Target format: mp4, mov, webm")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { to: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting video...");
      await runCommandAction({
        spinner,
        successMessage: "Video converted.",
        action: () =>
          videoEditorAdapter.convert({
            inputPath,
            to: input.to,
            output: input.output,
          }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("compress")
    .description("Compress a local video using a configurable CRF value")
    .argument("<inputPath>", "Input video path")
    .option("--crf <value>", "CRF quality value, lower is higher quality", "28")
    .option("--preset <name>", "Encoding preset, e.g. fast, medium, slow", "medium")
    .option("--to <format>", "Optional target format: mp4, mov, webm")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { crf?: string; preset?: string; to?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Compressing video...");
        await runCommandAction({
          spinner,
          successMessage: "Video compressed.",
          action: () =>
            videoEditorAdapter.compress({
              inputPath,
              crf: input.crf,
              preset: input.preset,
              to: input.to,
              output: input.output,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("thumbnail")
    .description("Extract a thumbnail from a local video")
    .argument("<inputPath>", "Input video path")
    .option("--at <time>", "Timestamp for the thumbnail", "00:00:01")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { at?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Extracting thumbnail...");
      await runCommandAction({
        spinner,
        successMessage: "Thumbnail extracted.",
        action: () =>
          videoEditorAdapter.thumbnail({
            inputPath,
            at: input.at,
            output: input.output,
          }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  return command;
}

export const videoEditorPlatformDefinition: PlatformDefinition = {
  id: "video",
  category: "editor",
  displayName: "Video Editor",
  description: "Edit local video files using ffmpeg",
  authStrategies: ["none"],
  buildCommand: buildVideoEditorCommand,
  adapter: videoEditorAdapter,
  examples: EXAMPLES,
};
