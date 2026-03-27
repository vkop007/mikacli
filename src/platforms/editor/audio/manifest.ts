import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { audioEditorAdapter } from "./adapter.js";
import { printAudioResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli audio info ./song.mp3",
  "autocli audio trim ./song.mp3 --start 00:00:10 --duration 30",
  "autocli audio convert ./song.wav --to mp3",
  "autocli audio compress ./song.wav --bitrate 128",
  "autocli audio silence-detect ./song.mp3 --threshold -45dB",
  "autocli audio loudness-report ./song.mp3",
  "autocli audio merge ./intro.mp3 ./chapter.mp3",
  "autocli audio fade-in ./song.mp3 --duration 3",
  "autocli audio trim-silence ./podcast.wav --threshold -45dB",
  "autocli audio waveform ./song.mp3 --width 1600",
  "autocli audio spectrogram ./song.mp3 --width 1600",
  "autocli audio normalize ./song.mp3 --loudness 16",
  "autocli audio volume ./song.mp3 --db -3",
  "autocli audio denoise ./voice.wav --reduction 20 --noise-floor -55",
] as const;

function buildAudioCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("audio").description("Edit local audio files using ffmpeg");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a local audio file")
    .argument("<inputPath>", "Input audio path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading audio info...");
      await runCommandAction({
        spinner,
        successMessage: "Audio info loaded.",
        action: () => audioEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("trim")
    .description("Trim a local audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--start <time>", "Trim start time")
    .option("--end <time>", "Trim end time")
    .option("--duration <time>", "Trim duration")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { start?: string; end?: string; duration?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Trimming audio...");
        await runCommandAction({
          spinner,
          successMessage: "Audio trimmed.",
          action: () =>
            audioEditorAdapter.trim({
              inputPath,
              start: input.start,
              end: input.end,
              duration: input.duration,
              output: input.output,
            }),
          onSuccess: (result) => printAudioResult(result, ctx.json),
        });
      },
    );

  command
    .command("convert")
    .description("Convert a local audio file to another format")
    .argument("<inputPath>", "Input audio path")
    .requiredOption("--to <format>", "Target format: mp3, m4a, aac, wav, flac, ogg, opus")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { to: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio converted.",
        action: () =>
          audioEditorAdapter.convert({
            inputPath,
            to: input.to,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("compress")
    .description("Compress an audio file to a lower bitrate")
    .argument("<inputPath>", "Input audio path")
    .option("--bitrate <kbps>", "Target bitrate in kbps", "128")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { bitrate?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Compressing audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio compressed.",
        action: () =>
          audioEditorAdapter.compress({
            inputPath,
            bitrate: input.bitrate,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("merge")
    .description("Merge multiple audio files in order")
    .argument("<inputPaths...>", "Two or more input audio paths")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPaths: string[], input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Merging audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio merged.",
        action: () => audioEditorAdapter.merge({ inputPaths, output: input.output }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("fade-in")
    .description("Apply a fade-in to an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--duration <seconds>", "Fade duration in seconds", "2")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { duration?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Applying fade-in...");
      await runCommandAction({
        spinner,
        successMessage: "Fade-in applied.",
        action: () =>
          audioEditorAdapter.fadeIn({
            inputPath,
            duration: input.duration,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("fade-out")
    .description("Apply a fade-out to an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--duration <seconds>", "Fade duration in seconds", "2")
    .option("--start <seconds>", "Optional fade start time in seconds")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { duration?: string; start?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Applying fade-out...");
      await runCommandAction({
        spinner,
        successMessage: "Fade-out applied.",
        action: () =>
          audioEditorAdapter.fadeOut({
            inputPath,
            duration: input.duration,
            start: input.start,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("trim-silence")
    .description("Remove leading and trailing silence from an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--threshold <value>", "Silence threshold, e.g. -45dB", "-50dB")
    .option("--duration <seconds>", "Minimum silence duration", "0.5")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { threshold?: string; duration?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Trimming silence...");
      await runCommandAction({
        spinner,
        successMessage: "Silence trimmed.",
        action: () =>
          audioEditorAdapter.trimSilence({
            inputPath,
            threshold: input.threshold,
            duration: input.duration,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("normalize")
    .description("Normalize audio loudness")
    .argument("<inputPath>", "Input audio path")
    .option("--loudness <lufs>", "Target loudness value", "-16")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { loudness?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Normalizing audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio normalized.",
        action: () =>
          audioEditorAdapter.normalize({
            inputPath,
            loudness: input.loudness,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("silence-detect")
    .description("Detect silent segments in an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--threshold <value>", "Silence threshold, e.g. -45dB", "-50dB")
    .option("--duration <seconds>", "Minimum silence duration", "0.5")
    .action(async (inputPath: string, input: { threshold?: string; duration?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Detecting silence...");
      await runCommandAction({
        spinner,
        successMessage: "Silence detection complete.",
        action: () =>
          audioEditorAdapter.silenceDetect({
            inputPath,
            threshold: input.threshold,
            duration: input.duration,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("loudness-report")
    .description("Measure loudness and normalization stats for an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--target-lufs <value>", "Target loudness value", "-16")
    .option("--true-peak <value>", "Target true peak in dBFS", "-1.5")
    .option("--lra <value>", "Target loudness range", "11")
    .action(
      async (
        inputPath: string,
        input: { targetLufs?: string; truePeak?: string; lra?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Measuring loudness...");
        await runCommandAction({
          spinner,
          successMessage: "Loudness report generated.",
          action: () =>
            audioEditorAdapter.loudnessReport({
              inputPath,
              targetLufs: input.targetLufs,
              truePeak: input.truePeak,
              lra: input.lra,
            }),
          onSuccess: (result) => printAudioResult(result, ctx.json),
        });
      },
    );

  command
    .command("volume")
    .description("Adjust audio volume by decibels")
    .argument("<inputPath>", "Input audio path")
    .option("--db <value>", "Volume change in decibels", "0")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { db?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Adjusting audio volume...");
      await runCommandAction({
        spinner,
        successMessage: "Audio volume adjusted.",
        action: () =>
          audioEditorAdapter.volume({
            inputPath,
            db: input.db,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("denoise")
    .description("Reduce steady background noise in an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--reduction <value>", "Noise reduction strength from 0.1 to 97", "18")
    .option("--noise-floor <value>", "Estimated noise floor in dB, e.g. -50", "-50")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { reduction?: string; noiseFloor?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Reducing background noise...");
        await runCommandAction({
          spinner,
          successMessage: "Audio denoised.",
          action: () =>
            audioEditorAdapter.denoise({
              inputPath,
              reduction: input.reduction,
              noiseFloor: input.noiseFloor,
              output: input.output,
            }),
          onSuccess: (result) => printAudioResult(result, ctx.json),
        });
      },
    );

  command
    .command("waveform")
    .description("Generate a waveform image from an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--width <px>", "Output image width in pixels", "1280")
    .option("--height <px>", "Output image height in pixels", "320")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { width?: string; height?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Rendering waveform...");
      await runCommandAction({
        spinner,
        successMessage: "Waveform generated.",
        action: () =>
          audioEditorAdapter.waveform({
            inputPath,
            width: input.width,
            height: input.height,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("spectrogram")
    .description("Generate a spectrogram image from an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--width <px>", "Output image width in pixels", "1600")
    .option("--height <px>", "Output image height in pixels", "900")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { width?: string; height?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Rendering spectrogram...");
      await runCommandAction({
        spinner,
        successMessage: "Spectrogram generated.",
        action: () =>
          audioEditorAdapter.spectrogram({
            inputPath,
            width: input.width,
            height: input.height,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  return command;
}

export const audioEditorPlatformDefinition: PlatformDefinition = {
  id: "audio" as PlatformDefinition["id"],
  category: "editor",
  displayName: "Audio Editor",
  description: "Edit local audio files using ffmpeg",
  authStrategies: ["none"],
  buildCommand: buildAudioCommand,
  adapter: audioEditorAdapter,
  examples: EXAMPLES,
};
