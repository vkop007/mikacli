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
  "autocli image upscale ./photo.png --factor 2",
  "autocli image compress ./photo.png --quality 82",
  "autocli image grayscale ./photo.png",
  "autocli image background-remove ./portrait.png --color '#00ff00'",
  "autocli image watermark ./photo.png --watermark ./logo.png --position bottom-right",
  "autocli image upscale ./photo.png --scale 4x --model realesrgan",
  "autocli image collage ./a.png ./b.png ./c.png --layout grid --gap 10",
  "autocli image palette ./photo.png --colors 5 --json",
  "autocli image exif ./photo.jpg --json",
  "autocli image crop ./photo.png --aspect 16:9 --gravity center",
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
    .option("--width <px>", "Crop width in pixels")
    .option("--height <px>", "Crop height in pixels")
    .option("--x <px>", "Left offset in pixels")
    .option("--y <px>", "Top offset in pixels")
    .option("--aspect <ratio>", "Aspect ratio, e.g. 16:9")
    .option("--gravity <value>", "Gravity for aspect crop, e.g. center", "center")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { width?: string; height?: string; x?: string; y?: string; aspect?: string; gravity?: string; output?: string },
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
              aspect: input.aspect,
              gravity: input.gravity,
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

  command
    .command("upscale")
    .description("Upscale a local image with high-quality Lanczos resampling")
    .argument("<inputPath>", "Input image path")
    .option("--factor <value>", "Upscale factor from 1 to 8", "2")
    .option("--scale <value>", "Alias for factor")
    .option("--model <name>", "Model identifier (currently passed verbatim if needed)")
    .option("--width <px>", "Explicit output width in pixels")
    .option("--height <px>", "Explicit output height in pixels")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { factor?: string; scale?: string; model?: string; width?: string; height?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Upscaling image...");
        await runCommandAction({
          spinner,
          successMessage: "Image upscaled.",
          action: () =>
            imageEditorAdapter.upscale({
              inputPath,
              factor: input.factor,
              scale: input.scale,
              model: input.model,
              width: input.width,
              height: input.height,
              output: input.output,
            }),
          onSuccess: (result) => printImageEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("compress")
    .description("Compress an image to a smaller JPEG output")
    .argument("<inputPath>", "Input image path")
    .option("--quality <value>", "JPEG quality from 1 to 100", "82")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { quality?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Compressing image...");
      await runCommandAction({
        spinner,
        successMessage: "Image compressed.",
        action: () =>
          imageEditorAdapter.compress({
            inputPath,
            quality: input.quality,
            output: input.output,
          }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("grayscale")
    .description("Convert an image to grayscale")
    .argument("<inputPath>", "Input image path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Applying grayscale...");
      await runCommandAction({
        spinner,
        successMessage: "Grayscale image saved.",
        action: () => imageEditorAdapter.grayscale({ inputPath, output: input.output }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("blur")
    .description("Blur an image")
    .argument("<inputPath>", "Input image path")
    .option("--radius <value>", "Blur radius/sigma", "3")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { radius?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Blurring image...");
      await runCommandAction({
        spinner,
        successMessage: "Blurred image saved.",
        action: () =>
          imageEditorAdapter.blur({
            inputPath,
            radius: input.radius,
            output: input.output,
          }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("sharpen")
    .description("Sharpen an image")
    .argument("<inputPath>", "Input image path")
    .option("--amount <value>", "Sharpen amount", "1.5")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { amount?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sharpening image...");
      await runCommandAction({
        spinner,
        successMessage: "Sharpened image saved.",
        action: () =>
          imageEditorAdapter.sharpen({
            inputPath,
            amount: input.amount,
            output: input.output,
          }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("thumbnail")
    .description("Generate a smaller image thumbnail")
    .argument("<inputPath>", "Input image path")
    .option("--width <px>", "Thumbnail width in pixels", "320")
    .option("--height <px>", "Optional thumbnail height in pixels")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { width?: string; height?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating thumbnail...");
      await runCommandAction({
        spinner,
        successMessage: "Thumbnail created.",
        action: () =>
          imageEditorAdapter.thumbnail({
            inputPath,
            width: input.width,
            height: input.height,
            output: input.output,
          }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("strip-metadata")
    .description("Write a copy of the image without embedded metadata")
    .argument("<inputPath>", "Input image path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Removing metadata...");
      await runCommandAction({
        spinner,
        successMessage: "Metadata removed.",
        action: () => imageEditorAdapter.stripMetadata({ inputPath, output: input.output }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("background-remove")
    .description("Remove a near-solid background color and save a transparent PNG")
    .argument("<inputPath>", "Input image path")
    .option("--color <value>", "Background color to key out, e.g. #ffffff or green", "#ffffff")
    .option("--similarity <value>", "Color match strength from 0.01 to 1", "0.18")
    .option("--blend <value>", "Soft edge blend from 0 to 1", "0.08")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { color?: string; similarity?: string; blend?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Removing image background...");
        await runCommandAction({
          spinner,
          successMessage: "Background removed.",
          action: () =>
            imageEditorAdapter.backgroundRemove({
              inputPath,
              color: input.color,
              similarity: input.similarity,
              blend: input.blend,
              output: input.output,
            }),
          onSuccess: (result) => printImageEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("watermark")
    .description("Overlay a watermark image on top of an image")
    .argument("<inputPath>", "Input image path")
    .requiredOption("--watermark <path>", "Watermark image path")
    .option("--position <value>", "Overlay position: top-left, top-right, bottom-left, bottom-right, center")
    .option("--margin <px>", "Overlay margin in pixels", "16")
    .option("--output <path>", "Exact output file path")
    .action(
      async (
        inputPath: string,
        input: { watermark: string; position?: string; margin?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Applying watermark...");
        await runCommandAction({
          spinner,
          successMessage: "Watermark applied.",
          action: () =>
            imageEditorAdapter.watermark({
              inputPath,
              watermarkPath: input.watermark,
              position: input.position,
              margin: input.margin,
              output: input.output,
            }),
          onSuccess: (result) => printImageEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("exif")
    .description("Extract EXIF metadata from an image")
    .argument("<inputPath>", "Input image path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Extracting EXIF...");
      await runCommandAction({
        spinner,
        successMessage: "EXIF extracted.",
        action: () => imageEditorAdapter.exif({ inputPath }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("palette")
    .description("Generate a color palette from an image")
    .argument("<inputPath>", "Input image path")
    .option("--colors <value>", "Number of colors to extract", "5")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { colors?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Generating palette...");
      await runCommandAction({
        spinner,
        successMessage: "Palette generated.",
        action: () => imageEditorAdapter.palette({ inputPath, colors: input.colors, output: input.output }),
        onSuccess: (result) => printImageEditorResult(result, ctx.json),
      });
    });

  command
    .command("collage")
    .description("Create a collage grid from multiple images")
    .argument("<inputPaths...>", "Two or more input image paths")
    .option("--layout <name>", "Collage layout: grid, horizontal, vertical", "grid")
    .option("--gap <px>", "Gap between images in pixels", "0")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPaths: string[], input: { layout?: string; gap?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating collage...");
      await runCommandAction({
        spinner,
        successMessage: "Collage generated.",
        action: () => imageEditorAdapter.collage({ inputPaths, layout: input.layout, gap: input.gap, output: input.output }),
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
