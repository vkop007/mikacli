import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { archiveEditorAdapter } from "./adapter.js";
import { printArchiveEditorResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli archive info ./bundle.zip",
  "mikacli archive list ./bundle.zip",
  "mikacli archive create ./bundle.zip ./dist ./README.md",
  "mikacli archive extract ./bundle.zip --output-dir ./bundle",
  "mikacli archive gzip ./notes.txt",
  "mikacli archive gunzip ./notes.txt.gz",
] as const;

function buildArchiveEditorCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("archive").description("Create, inspect, and extract archive files");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a local archive")
    .argument("<inputPath>", "Input archive path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading archive info...");
      await runCommandAction({
        spinner,
        successMessage: "Archive info loaded.",
        action: () => archiveEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printArchiveEditorResult(result, ctx.json),
      });
    });

  command
    .command("list")
    .description("List entries inside an archive")
    .argument("<inputPath>", "Input archive path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Listing archive entries...");
      await runCommandAction({
        spinner,
        successMessage: "Archive entries loaded.",
        action: () => archiveEditorAdapter.list({ inputPath }),
        onSuccess: (result) => printArchiveEditorResult(result, ctx.json),
      });
    });

  command
    .command("create")
    .description("Create a zip, tar, tar.gz, tgz, gz, or 7z archive")
    .argument("<outputPath>", "Output archive path")
    .argument("<inputPaths...>", "Input files or directories")
    .option("--format <format>", "Archive format override: zip, tar, tar.gz, tgz, gz, 7z")
    .action(async (outputPath: string, inputPaths: string[], input: { format?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating archive...");
      await runCommandAction({
        spinner,
        successMessage: "Archive created.",
        action: () =>
          archiveEditorAdapter.create({
            outputPath,
            inputPaths,
            format: input.format,
          }),
        onSuccess: (result) => printArchiveEditorResult(result, ctx.json),
      });
    });

  command
    .command("extract")
    .description("Extract an archive")
    .argument("<inputPath>", "Input archive path")
    .option("--output-dir <path>", "Directory to extract into")
    .action(async (inputPath: string, input: { outputDir?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Extracting archive...");
      await runCommandAction({
        spinner,
        successMessage: "Archive extracted.",
        action: () =>
          archiveEditorAdapter.extract({
            inputPath,
            outputDir: input.outputDir,
          }),
        onSuccess: (result) => printArchiveEditorResult(result, ctx.json),
      });
    });

  command
    .command("gzip")
    .description("Compress a single file to .gz")
    .argument("<inputPath>", "Input file path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Gzipping file...");
      await runCommandAction({
        spinner,
        successMessage: "File gzipped.",
        action: () =>
          archiveEditorAdapter.gzip({
            inputPath,
            output: input.output,
          }),
        onSuccess: (result) => printArchiveEditorResult(result, ctx.json),
      });
    });

  command
    .command("gunzip")
    .description("Decompress a .gz file")
    .argument("<inputPath>", "Input .gz file path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Gunzipping file...");
      await runCommandAction({
        spinner,
        successMessage: "File gunzipped.",
        action: () =>
          archiveEditorAdapter.gunzip({
            inputPath,
            output: input.output,
          }),
        onSuccess: (result) => printArchiveEditorResult(result, ctx.json),
      });
    });

  return command;
}

export const archiveEditorPlatformDefinition: PlatformDefinition = {
  id: "archive" as PlatformDefinition["id"],
  category: "editor",
  displayName: "Archive Editor",
  description: "Create, inspect, and extract archive files",
  authStrategies: ["none"],
  buildCommand: buildArchiveEditorCommand,
  adapter: archiveEditorAdapter,
  examples: EXAMPLES,
};
