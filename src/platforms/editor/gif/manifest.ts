import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { gifEditorAdapter } from "./adapter.js";
import { printGifEditorResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli gif info ./clip.gif",
  "mikacli gif create ./clip.mp4 --start 00:00:01 --duration 2",
  "mikacli gif optimize ./clip.gif --width 480",
  "mikacli gif to-video ./clip.gif --to mp4",
] as const;

function buildGifEditorCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("gif").description("Create, optimize, and convert GIFs using ffmpeg");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a GIF or GIF-like animation file")
    .argument("<inputPath>", "Input GIF path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading GIF info...");
      await runCommandAction({
        spinner,
        successMessage: "GIF info loaded.",
        action: () => gifEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printGifEditorResult(result, ctx.json),
      });
    });

  command
    .command("create")
    .alias("from-video")
    .description("Create a GIF from a video segment")
    .argument("<inputPath>", "Input video path")
    .option("--start <time>", "GIF start time")
    .option("--duration <time>", "GIF duration", "2")
    .option("--fps <value>", "GIF frame rate", "12")
    .option("--width <px>", "GIF width in pixels", "480")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { start?: string; duration?: string; fps?: string; width?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Creating GIF...");
        await runCommandAction({
          spinner,
          successMessage: "GIF created.",
          action: () =>
            gifEditorAdapter.create({
              inputPath,
              start: input.start,
              duration: input.duration,
              fps: input.fps,
              width: input.width,
              output: input.output,
            }),
          onSuccess: (result) => printGifEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("optimize")
    .description("Re-encode and optimize a GIF")
    .argument("<inputPath>", "Input GIF path")
    .option("--fps <value>", "Target frame rate", "12")
    .option("--width <px>", "Target width in pixels", "480")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { fps?: string; width?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Optimizing GIF...");
      await runCommandAction({
        spinner,
        successMessage: "GIF optimized.",
        action: () =>
          gifEditorAdapter.optimize({
            inputPath,
            fps: input.fps,
            width: input.width,
            output: input.output,
          }),
        onSuccess: (result) => printGifEditorResult(result, ctx.json),
      });
    });

  command
    .command("to-video")
    .description("Convert a GIF to a regular video file")
    .argument("<inputPath>", "Input GIF path")
    .option("--to <format>", "Target video format: mp4, mov, webm", "mp4")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { to?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting GIF to video...");
      await runCommandAction({
        spinner,
        successMessage: "GIF converted to video.",
        action: () =>
          gifEditorAdapter.toVideo({
            inputPath,
            to: input.to,
            output: input.output,
          }),
        onSuccess: (result) => printGifEditorResult(result, ctx.json),
      });
    });

  return command;
}

export const gifEditorPlatformDefinition: PlatformDefinition = {
  id: "gif" as PlatformDefinition["id"],
  category: "editor",
  displayName: "GIF Editor",
  description: "Create, optimize, and convert GIFs using ffmpeg",
  authStrategies: ["none"],
  buildCommand: buildGifEditorCommand,
  adapter: gifEditorAdapter,
  examples: EXAMPLES,
};
