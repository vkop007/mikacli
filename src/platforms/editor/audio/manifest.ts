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
  "autocli audio split ./podcast.mp3 --by-silence",
  "autocli audio mix ./voice.wav --background ./music.mp3 --bg-volume -12",
  "autocli audio speed ./lecture.mp3 --rate 1.5",
  "autocli audio eq ./song.mp3 --bass +3 --treble -2",
  "autocli audio reverse ./clip.mp3",
  "autocli audio mono ./stereo.mp3",
  "autocli audio extract ./podcast.mp3 --start 00:10:00 --end 00:15:00",
  "autocli audio resample ./audio.wav --rate 44100",
  "autocli audio tag ./song.mp3 --title 'My Song' --artist 'Me'",
  "autocli audio merge ./a.mp3 ./b.mp3 --crossfade 3",
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
    .description("Convert local audio files to another format")
    .argument("<inputPaths...>", "One or more input audio paths (supports glob)")
    .requiredOption("--to <format>", "Target format: mp3, m4a, aac, wav, flac, ogg, opus")
    .option("--output <path>", "Exact output file path (only used if 1 input file)")
    .action(async (inputPaths: string[], input: { to: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner(`Converting ${inputPaths.length} audio file(s)...`);
      await runCommandAction({
        spinner,
        successMessage: `Converted ${inputPaths.length} audio file(s).`,
        action: async () => {
          if (inputPaths.length === 1) {
             return audioEditorAdapter.convert({ inputPath: inputPaths[0]!, to: input.to, output: input.output });
          }
          const results = [];
          for (const path of inputPaths) {
             const res = await audioEditorAdapter.convert({ inputPath: path, to: input.to });
             results.push(res);
          }
          return {
             ok: true, platform: "audio", account: "local", action: "convert", message: `Converted ${inputPaths.length} files.`,
             data: { convertedRows: results.map(r => r.data) }
          } as any;
        },
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
    .option("--crossfade <seconds>", "Crossfade duration in seconds", "0")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPaths: string[], input: { crossfade?: string, output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Merging audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio merged.",
        action: () => audioEditorAdapter.merge({ inputPaths, crossfade: input.crossfade, output: input.output }),
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

  command
    .command("split")
    .description("Split an audio file into segments")
    .argument("<inputPath>", "Input audio path")
    .option("--every <seconds>", "Duration of each segment in seconds", "30")
    .option("--output-dir <path>", "Directory to save the segments in")
    .option("--by-silence", "Split audio by detecting silences")
    .option("--silence-threshold <value>", "Silence threshold, e.g. -45dB", "-50dB")
    .option("--silence-duration <seconds>", "Minimum silence duration", "0.5")
    .action(async (inputPath: string, input: { every?: string; outputDir?: string; bySilence?: boolean; silenceThreshold?: string; silenceDuration?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Splitting audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio split.",
        action: () =>
          audioEditorAdapter.split({
            inputPath,
            every: input.every,
            outputDir: input.outputDir,
            bySilence: input.bySilence,
            silenceThreshold: input.silenceThreshold,
            silenceDuration: input.silenceDuration,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("mix")
    .description("Overlay background audio on top of the main audio")
    .argument("<inputPath>", "Main input audio path (e.g. voice)")
    .requiredOption("--background <path>", "Background audio path (e.g. music)")
    .option("--bg-volume <db>", "Background audio volume in decibels", "-12")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { background: string; bgVolume?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Mixing audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio mixed.",
        action: () =>
          audioEditorAdapter.mix({
            inputPath,
            background: input.background,
            bgVolume: input.bgVolume,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("speed")
    .description("Change audio playback speed without altering pitch")
    .argument("<inputPath>", "Input audio path")
    .option("--rate <multiplier>", "Playback speed multiplier (e.g. 1.5)", "1.5")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { rate?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Adjusting audio speed...");
      await runCommandAction({
        spinner,
        successMessage: "Audio speed adjusted.",
        action: () =>
          audioEditorAdapter.speed({
            inputPath,
            rate: input.rate,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("extract")
    .description("Extract a segment from an audio file (intuitive alias for trim)")
    .argument("<inputPath>", "Input audio path")
    .requiredOption("--start <time>", "Extract start time (e.g. 00:10:00)")
    .requiredOption("--end <time>", "Extract end time (e.g. 00:15:00)")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { start: string; end: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Extracting segment...");
      await runCommandAction({
        spinner,
        successMessage: "Audio segment extracted.",
        action: () =>
          audioEditorAdapter.trim({
            inputPath,
            start: input.start,
            end: input.end,
            output: input.output,
          }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("eq")
    .description("Apply an equalizer to adjust bass and treble")
    .argument("<inputPath>", "Input audio path")
    .option("--bass <db>", "Bass adjustment in dB", "0")
    .option("--treble <db>", "Treble adjustment in dB", "0")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { bass?: string; treble?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Applying equalizer...");
      await runCommandAction({
        spinner,
        successMessage: "Equalizer applied.",
        action: () => audioEditorAdapter.eq({ inputPath, bass: input.bass, treble: input.treble, output: input.output }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("reverse")
    .description("Reverse an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Reversing audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio reversed.",
        action: () => audioEditorAdapter.reverse({ inputPath, output: input.output }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("mono")
    .description("Mix audio down to a single mono channel")
    .argument("<inputPath>", "Input audio path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting to mono...");
      await runCommandAction({
        spinner,
        successMessage: "Converted to mono.",
        action: () => audioEditorAdapter.mono({ inputPath, output: input.output }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("stereo")
    .description("Convert audio to stereo channels")
    .argument("<inputPath>", "Input audio path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting to stereo...");
      await runCommandAction({
        spinner,
        successMessage: "Converted to stereo.",
        action: () => audioEditorAdapter.stereo({ inputPath, output: input.output }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("resample")
    .description("Change the sample rate of an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--rate <hz>", "Target sample rate in Hz", "44100")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { rate?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Resampling audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio resampled.",
        action: () => audioEditorAdapter.resample({ inputPath, rate: input.rate, output: input.output }),
        onSuccess: (result) => printAudioResult(result, ctx.json),
      });
    });

  command
    .command("tag")
    .description("Edit ID3/metadata tags of an audio file")
    .argument("<inputPath>", "Input audio path")
    .option("--title <text>", "Track title")
    .option("--artist <text>", "Track artist")
    .option("--album <text>", "Track album")
    .option("--year <text>", "Track release year")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { title?: string; artist?: string; album?: string; year?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Updating audio tags...");
      await runCommandAction({
        spinner,
        successMessage: "Audio tags updated.",
        action: () => audioEditorAdapter.tag({ inputPath, title: input.title, artist: input.artist, album: input.album, year: input.year, output: input.output }),
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
