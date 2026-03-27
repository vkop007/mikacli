import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { imageEditorAdapter } from "./adapter.js";
import { printImageEditorResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli image info ./photo.png",
  "autocli image resize ./photo.png --width 1200",
  "autocli image crop ./photo.png --width 1080 --height 1080",
  "autocli image convert ./photo.webp --to png",
  "autocli image rotate ./photo.png --degrees 90",
] as const;

function buildImageEditorCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("image").description("Edit local image files using ffmpeg");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a local image file")
    .argument("<inputPath>", "Input image path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading image info...");
      await runCommandAction({
        spinner,
        successMessage: "Image info loaded.",
        action: () => imageEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("resize")
    .description("Resize a local image")
    .argument("<inputPath>", "Input image path")
    .option("--width <px>", "Target width in pixels")
    .option("--height <px>", "Target height in pixels")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { width?: string; height?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Resizing image...");
      await runCommandAction({
        spinner,
        successMessage: "Image resized.",
        action: () =>
          imageEditorAdapter.resize({
            inputPath,
            width: input.width,
            height: input.height,
            output: input.output,
          }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("crop")
    .description("Crop a local image")
    .argument("<inputPath>", "Input image path")
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
        const spinner = logger.spinner("Cropping image...");
        await runCommandAction({
          spinner,
          successMessage: "Image cropped.",
          action: () =>
            imageEditorAdapter.crop({
              inputPath,
              width: input.width,
              height: input.height,
              x: input.x,
              y: input.y,
              output: input.output,
            }),
          onSuccess: (result) => printImageEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("convert")
    .description("Convert a local image to another format")
    .argument("<inputPath>", "Input image path")
    .requiredOption("--to <format>", "Target format: png, jpg, jpeg, webp, bmp")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { to: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting image...");
      await runCommandAction({
        spinner,
        successMessage: "Image converted.",
        action: () =>
          imageEditorAdapter.convert({
            inputPath,
            to: input.to,
            output: input.output,
          }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("rotate")
    .description("Rotate a local image by degrees")
    .argument("<inputPath>", "Input image path")
    .requiredOption("--degrees <value>", "Rotation angle in degrees")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { degrees: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Rotating image...");
      await runCommandAction({
        spinner,
        successMessage: "Image rotated.",
        action: () =>
          imageEditorAdapter.rotate({
            inputPath,
            degrees: input.degrees,
            output: input.output,
          }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  return command;
}

export const imageEditorPlatformDefinition: PlatformDefinition = {
  id: "image",
  category: "editor",
  displayName: "Image Editor",
  description: "Edit local image files using ffmpeg",
  authStrategies: ["none"],
  buildCommand: buildImageEditorCommand,
  adapter: imageEditorAdapter,
  examples: EXAMPLES,
};
