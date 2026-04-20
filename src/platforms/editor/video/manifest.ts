import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { videoEditorAdapter } from "./adapter.js";
import { printVideoEditorResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli video info ./clip.mp4",
  "mikacli video trim ./clip.mp4 --start 00:00:05 --duration 10",
  "mikacli video split ./clip.mp4 --duration 00:00:15 --output-dir ./parts",
  "mikacli video scene-detect ./clip.mp4",
  "mikacli video stabilize ./clip.mp4",
  "mikacli video convert ./clip.mov --to mp4",
  "mikacli video compress ./clip.mp4 --crf 28",
  "mikacli video speed ./clip.mp4 --factor 1.5",
  "mikacli video reverse ./clip.mp4",
  "mikacli video boomerang ./clip.mp4",
  "mikacli video overlay-image ./clip.mp4 --overlay ./logo.png --position bottom-right",
  'mikacli video overlay-text ./clip.mp4 "Ship it" --position bottom-center',
  "mikacli video blur ./clip.mp4 --x 120 --y 80 --width 360 --height 200 --start 00:00:05 --duration 3 --corner-radius 24",
  "mikacli video audio-replace ./clip.mp4 --audio ./music.mp3",
  "mikacli video frame-extract ./clip.mp4 --quality low --output-dir ./frames",
  "mikacli video frame-extract ./clip.mp4 --quality high --output-dir ./frames",
  "mikacli video thumbnail ./clip.mp4 --at 00:00:03",
  "mikacli video extract-audio ./clip.mp4 --to mp3",
  "mikacli video to-gif ./clip.mp4 --start 10 --duration 3",
  "mikacli video concat ./a.mp4 ./b.mp4 --transition fade --duration 1",
  "mikacli video watermark ./clip.mp4 --image ./logo.png --position bottom-right",
  "mikacli video embed-subs ./video.mp4 --srt ./captions.srt",
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
        onSuccess: (result) => printVideoEditorResult(result, ctx.json, ctx),
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
    .command("split")
    .description("Split a local video into equal-duration parts")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--duration <time>", "Segment duration, e.g. 15 or 00:00:15")
    .option("--output-dir <path>", "Directory to write video parts into")
    .option("--prefix <name>", "Filename prefix for generated parts")
    .option("--to <format>", "Optional target format: mp4, mov, webm")
    .action(
      async (
        inputPath: string,
        input: { duration: string; outputDir?: string; prefix?: string; to?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Splitting video...");
        await runCommandAction({
          spinner,
          successMessage: "Video split complete.",
          action: () =>
            videoEditorAdapter.split({
              inputPath,
              duration: input.duration,
              outputDir: input.outputDir,
              prefix: input.prefix,
              to: input.to,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("scene-detect")
    .description("Detect scene changes in a local video")
    .argument("<inputPath>", "Input video path")
    .option("--threshold <value>", "Scene change threshold between 0 and 100", "10")
    .action(async (inputPath: string, input: { threshold?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Detecting scene changes...");
      await runCommandAction({
        spinner,
        successMessage: "Scene changes detected.",
        action: () =>
          videoEditorAdapter.sceneDetect({
            inputPath,
            threshold: input.threshold,
          }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("stabilize")
    .description("Stabilize a shaky local video")
    .argument("<inputPath>", "Input video path")
    .option("--method <name>", "Stabilization method: auto, vidstab, or deshake", "auto")
    .option("--shakiness <value>", "vidstab shakiness from 1 to 10", "7")
    .option("--accuracy <value>", "vidstab accuracy from 1 to 15", "9")
    .option("--smoothing <value>", "vidstab smoothing from 1 to 100", "15")
    .option("--zoom <value>", "Optional stabilization zoom from 0 to 10", "0")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { method?: string; shakiness?: string; accuracy?: string; smoothing?: string; zoom?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Stabilizing video...");
        await runCommandAction({
          spinner,
          successMessage: "Video stabilized.",
          action: () =>
            videoEditorAdapter.stabilize({
              inputPath,
              method: input.method,
              shakiness: input.shakiness,
              accuracy: input.accuracy,
              smoothing: input.smoothing,
              zoom: input.zoom,
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
    .command("speed")
    .description("Change the playback speed of a local video")
    .argument("<inputPath>", "Input video path")
    .option("--factor <value>", "Speed factor, e.g. 2 for 2x faster or 0.5 for half speed", "1.5")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { factor?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Adjusting video speed...");
      await runCommandAction({
        spinner,
        successMessage: "Video speed adjusted.",
        action: () =>
          videoEditorAdapter.speed({
            inputPath,
            factor: input.factor,
            output: input.output,
          }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("reverse")
    .description("Reverse a local video, including audio when present")
    .argument("<inputPath>", "Input video path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Reversing video...");
      await runCommandAction({
        spinner,
        successMessage: "Video reversed.",
        action: () => videoEditorAdapter.reverse({ inputPath, output: input.output }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("boomerang")
    .description("Create a boomerang-style video that plays forward and backward")
    .argument("<inputPath>", "Input video path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating boomerang...");
      await runCommandAction({
        spinner,
        successMessage: "Boomerang created.",
        action: () => videoEditorAdapter.boomerang({ inputPath, output: input.output }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("overlay-image")
    .alias("watermark")
    .description("Overlay an image (or watermark) on top of a video")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--overlay <path>", "Overlay image path")
    .option("--position <value>", "Overlay position: top-left, top-right, bottom-left, bottom-right, center")
    .option("--margin <px>", "Overlay margin in pixels", "16")
    .option("--width <px>", "Optional overlay width in pixels")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { overlay: string; position?: string; margin?: string; width?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Overlaying image...");
        await runCommandAction({
          spinner,
          successMessage: "Image overlaid.",
          action: () =>
            videoEditorAdapter.overlayImage({
              inputPath,
              overlayPath: input.overlay,
              position: input.position,
              margin: input.margin,
              width: input.width,
              output: input.output,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("overlay-text")
    .description("Draw text on top of a video")
    .argument("<inputPath>", "Input video path")
    .argument("<text...>", "Text to draw on the video")
    .option("--position <value>", "Text position: top-left, top-right, bottom-left, bottom-right, center, top-center, bottom-center")
    .option("--margin <px>", "Text margin in pixels", "24")
    .option("--font-size <px>", "Font size in pixels", "48")
    .option("--color <value>", "Text color, e.g. white or #ffffff", "white")
    .option("--box-color <value>", "Background box color", "black")
    .option("--box-opacity <value>", "Background box opacity from 0 to 1", "0.45")
    .option("--no-box", "Disable the background box behind the text")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        text: string[],
        input: {
          position?: string;
          margin?: string;
          fontSize?: string;
          color?: string;
          box?: boolean;
          boxColor?: string;
          boxOpacity?: string;
          output?: string;
        },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Overlaying text...");
        await runCommandAction({
          spinner,
          successMessage: "Text overlaid.",
          action: () =>
            videoEditorAdapter.overlayText({
              inputPath,
              text: text.join(" "),
              position: input.position,
              margin: input.margin,
              fontSize: input.fontSize,
              color: input.color,
              box: input.box,
              boxColor: input.boxColor,
              boxOpacity: input.boxOpacity,
              output: input.output,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("blur")
    .alias("blur-region")
    .description("Blur a rectangular region in a local video")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--width <px>", "Blur region width in pixels")
    .requiredOption("--height <px>", "Blur region height in pixels")
    .option("--x <px>", "Left offset in pixels", "0")
    .option("--y <px>", "Top offset in pixels", "0")
    .option("--start <time>", "When the blur should begin")
    .option("--end <time>", "When the blur should stop")
    .option("--duration <time>", "How long the blur should last")
    .option("--radius <value>", "Blur radius in pixels", "20")
    .option("--power <value>", "Blur power multiplier from 1 to 5", "1")
    .option("--corner-radius <px>", "Rounded corner radius for the blurred patch", "0")
    .option("--border-radius <px>", "Alias for --corner-radius")
    .option("--feather <px>", "Soften the blur edge by this many pixels")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: {
          width: string;
          height: string;
          x?: string;
          y?: string;
          start?: string;
          end?: string;
          duration?: string;
          radius?: string;
          power?: string;
          cornerRadius?: string;
          borderRadius?: string;
          feather?: string;
          output?: string;
        },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Blurring video region...");
        await runCommandAction({
          spinner,
          successMessage: "Video region blurred.",
          action: () =>
            videoEditorAdapter.blurRegion({
              inputPath,
              width: input.width,
              height: input.height,
              x: input.x,
              y: input.y,
              start: input.start,
              end: input.end,
              duration: input.duration,
              radius: input.radius,
              power: input.power,
              cornerRadius: input.cornerRadius,
              borderRadius: input.borderRadius,
              feather: input.feather,
              output: input.output,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("audio-replace")
    .alias("replace-audio")
    .description("Replace the audio track in a local video")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--audio <path>", "Replacement audio path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { audio: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Replacing audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio replaced.",
        action: () =>
          videoEditorAdapter.audioReplace({
            inputPath,
            audioPath: input.audio,
            output: input.output,
          }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("frame-extract")
    .description("Extract a sequence of frames from a local video")
    .argument("<inputPath>", "Input video path")
    .option("--quality <level>", "Frame extraction density: low (1 fps), medium (5 fps), high (24 fps)", "medium")
    .option("--fps <value>", "Override frame rate (1-120). Overrides --quality if specified.")
    .option("--start <time>", "Extraction start time")
    .option("--duration <time>", "Extraction duration")
    .option("--output-dir <path>", "Directory for extracted frames")
    .option("--prefix <name>", "Filename prefix for extracted frames")
    .option("--format <format>", "Frame image format: png, jpg, jpeg, webp", "png")
    .action(
      async (
        inputPath: string,
        input: {
          quality?: string;
          fps?: string;
          start?: string;
          duration?: string;
          outputDir?: string;
          prefix?: string;
          format?: string;
        },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Extracting frames...");
        await runCommandAction({
          spinner,
          successMessage: "Frames extracted.",
          action: () =>
            videoEditorAdapter.frameExtract({
              inputPath,
              start: input.start,
              duration: input.duration,
              fps: input.fps,
              quality: input.quality,
              outputDir: input.outputDir,
              prefix: input.prefix,
              format: input.format,
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

  command
    .command("resize")
    .description("Resize a local video")
    .argument("<inputPath>", "Input video path")
    .option("--width <px>", "Target width in pixels")
    .option("--height <px>", "Target height in pixels")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { width?: string; height?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Resizing video...");
      await runCommandAction({
        spinner,
        successMessage: "Video resized.",
        action: () =>
          videoEditorAdapter.resize({
            inputPath,
            width: input.width,
            height: input.height,
            output: input.output,
          }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("crop")
    .description("Crop a local video")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--width <px>", "Crop width in pixels")
    .requiredOption("--height <px>", "Crop height in pixels")
    .option("--x <px>", "Left offset in pixels", "0")
    .option("--y <px>", "Top offset in pixels", "0")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { width: string; height: string; x?: string; y?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Cropping video...");
        await runCommandAction({
          spinner,
          successMessage: "Video cropped.",
          action: () =>
            videoEditorAdapter.crop({
              inputPath,
              width: input.width,
              height: input.height,
              x: input.x,
              y: input.y,
              output: input.output,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("extract-audio")
    .description("Extract the audio track from a video")
    .argument("<inputPath>", "Input video path")
    .option("--to <format>", "Target audio format: mp3, wav, m4a, aac, flac", "mp3")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { to?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Extracting audio...");
      await runCommandAction({
        spinner,
        successMessage: "Audio extracted.",
        action: () =>
          videoEditorAdapter.extractAudio({
            inputPath,
            to: input.to,
            output: input.output,
          }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("mute")
    .description("Write a copy of the video without audio")
    .argument("<inputPath>", "Input video path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Muting video...");
      await runCommandAction({
        spinner,
        successMessage: "Video muted.",
        action: () => videoEditorAdapter.mute({ inputPath, output: input.output }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("gif")
    .alias("to-gif")
    .description("Create a GIF from a video segment")
    .argument("<inputPath>", "Input video path")
    .option("--start <time>", "GIF start time, e.g. 00:00:01")
    .option("--duration <time>", "GIF duration, e.g. 2 or 00:00:02", "2")
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
        const spinner = logger.spinner("Generating GIF...");
        await runCommandAction({
          spinner,
          successMessage: "GIF created.",
          action: () =>
            videoEditorAdapter.gif({
              inputPath,
              start: input.start,
              duration: input.duration,
              fps: input.fps,
              width: input.width,
              output: input.output,
            }),
          onSuccess: (result) => printVideoEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("concat")
    .description("Concatenate multiple videos in order (supports transitions)")
    .argument("<inputPaths...>", "Two or more input video paths")
    .option("--transition <name>", "Transition effect (e.g. fade, wipeleft, slideleft, circlecrop, pixelize, radial)")
    .option("--duration <seconds>", "Duration of the transition in seconds", "1")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPaths: string[], input: { transition?: string, duration?: string, output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Concatenating videos...");
      await runCommandAction({
        spinner,
        successMessage: "Videos concatenated.",
        action: () => videoEditorAdapter.concat({ inputPaths, transition: input.transition, duration: input.duration, output: input.output }),
        onSuccess: (result) => printVideoEditorResult(result, ctx.json),
      });
    });

  command
    .command("subtitle-burn")
    .alias("embed-subs")
    .description("Burn a subtitle file into a video")
    .argument("<inputPath>", "Input video path")
    .requiredOption("--subtitle <path>", "Subtitle file path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { subtitle: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Burning subtitles...");
      await runCommandAction({
        spinner,
        successMessage: "Subtitles burned in.",
        action: () =>
          videoEditorAdapter.subtitleBurn({
            inputPath,
            subtitlePath: input.subtitle,
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
