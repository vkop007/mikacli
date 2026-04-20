import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { documentEditorAdapter } from "./adapter.js";
import { printDocumentEditorResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli document info ./notes.docx",
  "mikacli document convert ./notes.docx --to txt",
  "mikacli document extract-text ./notes.docx",
  "mikacli document ocr ./scan.pdf",
  "mikacli document to-markdown ./notes.docx",
  "mikacli document metadata ./notes.docx",
] as const;

function buildDocumentEditorCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("document").description("Convert documents, extract text, and inspect metadata");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a local document")
    .argument("<inputPath>", "Input document path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading document info...");
      await runCommandAction({
        spinner,
        successMessage: "Document info loaded.",
        action: () => documentEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printDocumentEditorResult(result, ctx.json),
      });
    });

  command
    .command("convert")
    .description("Convert a local document to another format")
    .argument("<inputPath>", "Input document path")
    .requiredOption("--to <format>", "Target format: txt, rtf, rtfd, html, doc, docx, odt, wordml, webarchive, md")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { to: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting document...");
      await runCommandAction({
        spinner,
        successMessage: "Document converted.",
        action: () =>
          documentEditorAdapter.convert({
            inputPath,
            to: input.to,
            output: input.output,
          }),
        onSuccess: (result) => printDocumentEditorResult(result, ctx.json),
      });
    });

  command
    .command("extract-text")
    .description("Extract plain text from a local document")
    .argument("<inputPath>", "Input document path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Extracting text...");
      await runCommandAction({
        spinner,
        successMessage: "Document text extracted.",
        action: () =>
          documentEditorAdapter.extractText({
            inputPath,
            output: input.output,
          }),
        onSuccess: (result) => printDocumentEditorResult(result, ctx.json),
      });
    });

  command
    .command("ocr")
    .description("Extract text from a scanned document using OCR, with native extraction fallback when possible")
    .argument("<inputPath>", "Input document path")
    .option("--output <path>", "Exact output file path")
    .option("--language <code>", "Tesseract language code", "eng")
    .option("--psm <number>", "Tesseract page segmentation mode", "3")
    .action(
      async (
        inputPath: string,
        input: { output?: string; language?: string; psm?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Running OCR...");
        await runCommandAction({
          spinner,
          successMessage: "OCR complete.",
          action: () =>
            documentEditorAdapter.ocr({
              inputPath,
              output: input.output,
              language: input.language,
              psm: input.psm,
            }),
          onSuccess: (result) => printDocumentEditorResult(result, ctx.json),
        });
      },
    );

  command
    .command("to-markdown")
    .description("Extract document text and save it as Markdown")
    .argument("<inputPath>", "Input document path")
    .option("--output <path>", "Exact output file path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Converting document to Markdown...");
      await runCommandAction({
        spinner,
        successMessage: "Document converted to Markdown.",
        action: () =>
          documentEditorAdapter.toMarkdown({
            inputPath,
            output: input.output,
          }),
        onSuccess: (result) => printDocumentEditorResult(result, ctx.json),
      });
    });

  command
    .command("metadata")
    .description("Inspect metadata for a local document")
    .argument("<inputPath>", "Input document path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading document metadata...");
      await runCommandAction({
        spinner,
        successMessage: "Document metadata loaded.",
        action: () => documentEditorAdapter.metadata({ inputPath }),
        onSuccess: (result) => printDocumentEditorResult(result, ctx.json),
      });
    });

  return command;
}

export const documentEditorPlatformDefinition: PlatformDefinition = {
  id: "document" as PlatformDefinition["id"],
  category: "editor",
  displayName: "Document Editor",
  description: "Convert documents, extract text, and inspect metadata",
  authStrategies: ["none"],
  buildCommand: buildDocumentEditorCommand,
  adapter: documentEditorAdapter,
  examples: EXAMPLES,
};
