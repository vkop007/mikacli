import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { AutoCliError } from "../../../errors.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { printSubtitleEditorResult } from "./output.js";
import { subtitleEditorAdapter } from "./adapter.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli subtitle info ./captions.srt",
  "autocli subtitle convert ./captions.srt --to vtt",
  "autocli subtitle shift ./captions.vtt --by 2.5",
  "autocli subtitle sync ./captions.vtt --by 2.5",
  "autocli subtitle clean ./captions.srt",
  "autocli subtitle merge ./chapter1.srt ./chapter2.srt",
  "autocli subtitle burn ./movie.mp4 --subtitle ./captions.srt --output ./movie.subtitled.mp4",
] as const;

function buildSubtitleEditorCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("subtitle").description("Edit local subtitle files");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a local subtitle file")
    .argument("<inputPath>", "Input subtitle path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading subtitle info...");
      await runCommandAction({
        spinner,
        successMessage: "Subtitle info loaded.",
        action: () => subtitleEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printSubtitleEditorResult(result, ctx.json),
      });
    });

  command
    .command("convert")
    .description("Convert a subtitle file between SRT and VTT")
    .argument("<inputPath>", "Input subtitle path")
    .requiredOption("--to <format>", "Target format: srt or vtt")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { to: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting subtitles...");
      await runCommandAction({
        spinner,
        successMessage: "Subtitle converted.",
        action: () =>
          subtitleEditorAdapter.convert({
            inputPath,
            to: normalizeSubtitleFormat(input.to),
            output: input.output,
          }),
        onSuccess: (result) => printSubtitleEditorResult(result, ctx.json),
      });
    });

  command
    .command("shift")
    .description("Shift subtitle timestamps forward or backward")
    .argument("<inputPath>", "Input subtitle path")
    .requiredOption("--by <value>", "Shift amount in seconds or hh:mm:ss(.ms)")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { by: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Shifting subtitles...");
      await runCommandAction({
        spinner,
        successMessage: "Subtitle shifted.",
        action: () =>
          subtitleEditorAdapter.shift({
            inputPath,
            by: input.by,
            output: input.output,
          }),
        onSuccess: (result) => printSubtitleEditorResult(result, ctx.json),
      });
    });

  command
    .command("sync")
    .description("Synchronize subtitle timestamps using a fixed offset")
    .argument("<inputPath>", "Input subtitle path")
    .requiredOption("--by <value>", "Sync offset in seconds or hh:mm:ss(.ms)")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { by: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Syncing subtitles...");
      await runCommandAction({
        spinner,
        successMessage: "Subtitle synced.",
        action: () =>
          subtitleEditorAdapter.sync({
            inputPath,
            by: input.by,
            output: input.output,
          }),
        onSuccess: (result) => printSubtitleEditorResult(result, ctx.json),
      });
    });

  command
    .command("clean")
    .description("Normalize subtitle cue ordering, spacing, and duplicates")
    .argument("<inputPath>", "Input subtitle path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Cleaning subtitles...");
      await runCommandAction({
        spinner,
        successMessage: "Subtitle cleaned.",
        action: () =>
          subtitleEditorAdapter.clean({
            inputPath,
            output: input.output,
          }),
        onSuccess: (result) => printSubtitleEditorResult(result, ctx.json),
      });
    });

  command
    .command("merge")
    .description("Merge subtitle files with the same format")
    .argument("<inputPath>", "First subtitle file")
    .argument("[moreInputPaths...]", "Additional subtitle files")
    .option("--output <path>", "Exact output file path")
    .action(
      async (inputPath: string, moreInputPaths: string[], input: { output?: string }, cmd: Command) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Merging subtitles...");
        await runCommandAction({
          spinner,
          successMessage: "Subtitles merged.",
          action: () =>
            subtitleEditorAdapter.merge({
              inputPaths: [inputPath, ...(moreInputPaths ?? [])],
              output: input.output,
            }),
          onSuccess: (result) => printSubtitleEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("burn")
    .description("Burn a subtitle file into a local video using ffmpeg")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--subtitle <path>", "Subtitle file path to burn into the video")
    .option("--output <path>", "Exact output video path")
    .action(async (inputPath: string, input: { subtitle: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Burning subtitles into video...");
      await runCommandAction({
        spinner,
        successMessage: "Subtitles burned into video.",
        action: () =>
          subtitleEditorAdapter.burn({
            inputPath,
            subtitlePath: input.subtitle,
            output: input.output,
          }),
        onSuccess: (result) => printSubtitleEditorResult(result, ctx.json),
      });
    });

  return command;
}

export const subtitleEditorPlatformDefinition: PlatformDefinition = {
  id: "subtitle" as PlatformDefinition["id"],
  category: "editor",
  displayName: "Subtitle Editor",
  description: "Edit local subtitle files",
  authStrategies: ["none"],
  buildCommand: buildSubtitleEditorCommand,
  adapter: subtitleEditorAdapter,
  examples: EXAMPLES,
};

function normalizeSubtitleFormat(value: string): "srt" | "vtt" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "srt" || normalized === "vtt") {
    return normalized;
  }

  throw new AutoCliError("SUBTITLE_FORMAT_INVALID", `Unsupported subtitle format "${value}".`, {
    details: {
      supportedFormats: ["srt", "vtt"],
    },
  });
}
