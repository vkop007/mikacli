import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { pdfEditorAdapter } from "./adapter.js";
import { printPdfResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli pdf info ./document.pdf",
  "mikacli pdf merge ./out.pdf ./a.pdf ./b.pdf",
  "mikacli pdf split ./book.pdf --output-dir ./pages",
  "mikacli pdf to-images ./book.pdf --output-dir ./book-images",
  'mikacli pdf extract-pages ./book.pdf --pages "1,3-5" --output ./excerpt.pdf',
  'mikacli pdf remove-pages ./book.pdf --pages "2,4-6" --output ./book-trimmed.pdf',
  'mikacli pdf metadata ./book.pdf',
  'mikacli pdf metadata ./book.pdf --title "New Title" --author "MikaCLI" --output ./book-updated.pdf',
  "mikacli pdf rotate ./book.pdf --angle 90 --pages 1-3 --output ./book-rotated.pdf",
  'mikacli pdf reorder-pages ./book.pdf --pages "3,1-2" --output ./book-reordered.pdf',
  'mikacli pdf watermark ./book.pdf --text "CONFIDENTIAL" --pages "1-3"',
  "mikacli pdf encrypt ./book.pdf --output ./book-encrypted.pdf",
  "mikacli pdf decrypt ./book-encrypted.pdf --output ./book-decrypted.pdf --password secret",
  "mikacli pdf compress ./book.pdf --output ./book-optimized.pdf",
  "mikacli pdf optimize ./book.pdf --output ./book-optimized.pdf",
] as const;

function buildPdfCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("pdf").description("Edit local PDF files using qpdf and pdf-lib");
  command.addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command
    .command("info")
    .description("Inspect a local PDF")
    .argument("<inputPath>", "Input PDF path")
    .action(async (inputPath: string, _input: Record<string, unknown>, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading PDF info...");
      await runCommandAction({
        spinner,
        successMessage: "PDF info loaded.",
        action: () => pdfEditorAdapter.info({ inputPath }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  command
    .command("merge")
    .description("Merge multiple PDFs into a single output")
    .argument("<outputPath>", "Output PDF path")
    .argument("<inputPaths...>", "Input PDF files")
    .action(async (outputPath: string, inputPaths: string[], cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Merging PDFs...");
      await runCommandAction({
        spinner,
        successMessage: "PDFs merged.",
        action: () => pdfEditorAdapter.merge({ outputPath, inputPaths }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  command
    .command("split")
    .description("Split a local PDF into page PDFs")
    .argument("<inputPath>", "Input PDF path")
    .option("--from <page>", "First page to split", (value) => Number.parseInt(value, 10), 1)
    .option("--to <page>", "Last page to split", (value) => Number.parseInt(value, 10))
    .option("--output-dir <path>", "Directory to write split pages into")
    .option("--prefix <name>", "Filename prefix for split pages")
    .action(
      async (
        inputPath: string,
        input: { from?: number; to?: number; outputDir?: string; prefix?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Splitting PDF...");
        await runCommandAction({
          spinner,
          successMessage: "PDF split complete.",
          action: () =>
            pdfEditorAdapter.split({
              inputPath,
              fromPage: input.from,
              toPage: input.to,
              outputDir: input.outputDir,
              prefix: input.prefix,
            }),
          onSuccess: (result) => printPdfResult(result, ctx.json),
        });
      },
    );

  command
    .command("to-images")
    .description("Render a PDF into page images")
    .argument("<inputPath>", "Input PDF path")
    .option("--output-dir <path>", "Directory to write page images into")
    .option("--prefix <name>", "Filename prefix for rendered page images")
    .option("--format <value>", "Output image format: png or jpg", "png")
    .option("--size <pixels>", "Target preview/render size in pixels", "2048")
    .action(
      async (
        inputPath: string,
        input: { outputDir?: string; prefix?: string; format?: string; size?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Rendering PDF pages...");
        await runCommandAction({
          spinner,
          successMessage: "PDF images rendered.",
          action: () =>
            pdfEditorAdapter.toImages({
              inputPath,
              outputDir: input.outputDir,
              prefix: input.prefix,
              format: input.format,
              size: input.size,
            }),
          onSuccess: (result) => printPdfResult(result, ctx.json),
        });
      },
    );

  command
    .command("extract-pages")
    .description("Extract selected pages from a local PDF")
    .argument("<inputPath>", "Input PDF path")
    .requiredOption("--pages <spec>", "Comma-separated page spec like 1,3-5")
    .requiredOption("--output <path>", "Output PDF path")
    .action(async (inputPath: string, input: { pages: string; output: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Extracting pages...");
      await runCommandAction({
        spinner,
        successMessage: "Pages extracted.",
        action: () =>
          pdfEditorAdapter.extractPages({
            inputPath,
            pages: input.pages,
            outputPath: input.output,
          }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  command
    .command("remove-pages")
    .description("Create a new PDF without the selected pages")
    .argument("<inputPath>", "Input PDF path")
    .requiredOption("--pages <spec>", "Comma-separated page spec like 1,3-5")
    .option("--output <path>", "Output PDF path")
    .action(async (inputPath: string, input: { pages: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Removing PDF pages...");
      await runCommandAction({
        spinner,
        successMessage: "PDF pages removed.",
        action: () =>
          pdfEditorAdapter.removePages({
            inputPath,
            pages: input.pages,
            outputPath: input.output,
          }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  command
    .command("metadata")
    .description("Inspect or update PDF metadata")
    .argument("<inputPath>", "Input PDF path")
    .option("--output <path>", "Output PDF path")
    .option("--title <value>", "Metadata title")
    .option("--author <value>", "Metadata author")
    .option("--subject <value>", "Metadata subject")
    .option("--keywords <values>", "Comma-separated metadata keywords")
    .option("--creator <value>", "Metadata creator")
    .option("--producer <value>", "Metadata producer")
    .option("--creation-date <value>", "Metadata creation date (ISO-8601 or parseable date)")
    .option("--modification-date <value>", "Metadata modification date (ISO-8601 or parseable date)")
    .action(
      async (
        inputPath: string,
        input: {
          output?: string;
          title?: string;
          author?: string;
          subject?: string;
          keywords?: string;
          creator?: string;
          producer?: string;
          creationDate?: string;
          modificationDate?: string;
        },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Reading PDF metadata...");
        await runCommandAction({
          spinner,
          successMessage: "PDF metadata processed.",
          action: () =>
            pdfEditorAdapter.metadata({
              inputPath,
              outputPath: input.output,
              title: input.title,
              author: input.author,
              subject: input.subject,
              keywords: input.keywords,
              creator: input.creator,
              producer: input.producer,
              creationDate: input.creationDate,
              modificationDate: input.modificationDate,
            }),
          onSuccess: (result) => printPdfResult(result, ctx.json),
        });
      },
    );

  command
    .command("rotate")
    .description("Rotate pages in a local PDF using qpdf")
    .argument("<inputPath>", "Input PDF path")
    .requiredOption("--angle <degrees>", "Rotation angle, in multiples of 90", (value) => Number.parseInt(value, 10))
    .option("--pages <spec>", "Optional page spec like 1,3-5 or 1-3")
    .option("--output <path>", "Output PDF path")
    .action(async (inputPath: string, input: { angle: number; pages?: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Rotating PDF...");
      await runCommandAction({
        spinner,
        successMessage: "PDF rotated.",
        action: () =>
          pdfEditorAdapter.rotate({
            inputPath,
            angle: input.angle,
            pages: input.pages,
            outputPath: input.output,
          }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  command
    .command("reorder-pages")
    .description("Create a new PDF with pages reordered into a custom sequence")
    .argument("<inputPath>", "Input PDF path")
    .requiredOption("--pages <spec>", "Page order like 3,1-2,5")
    .option("--output <path>", "Output PDF path")
    .action(async (inputPath: string, input: { pages: string; output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Reordering PDF pages...");
      await runCommandAction({
        spinner,
        successMessage: "PDF pages reordered.",
        action: () =>
          pdfEditorAdapter.reorderPages({
            inputPath,
            pages: input.pages,
            outputPath: input.output,
          }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  command
    .command("watermark")
    .description("Apply a diagonal text watermark to a PDF")
    .argument("<inputPath>", "Input PDF path")
    .requiredOption("--text <value>", "Watermark text")
    .option("--pages <spec>", "Optional page spec like 1,3-5")
    .option("--opacity <value>", "Watermark opacity from 0.05 to 1", "0.08")
    .option("--size <value>", "Watermark font size", "42")
    .option("--color <value>", "Watermark color as #RRGGBB", "#808080")
    .option("--rotation <degrees>", "Watermark rotation in degrees", "315")
    .option("--output <path>", "Output PDF path")
    .action(
      async (
        inputPath: string,
        input: { text: string; pages?: string; opacity?: string; size?: string; color?: string; rotation?: string; output?: string },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Applying PDF watermark...");
        await runCommandAction({
          spinner,
          successMessage: "PDF watermarked.",
          action: () =>
            pdfEditorAdapter.watermark({
              inputPath,
              text: input.text,
              pages: input.pages,
              opacity: input.opacity,
              size: input.size,
              color: input.color,
              rotation: input.rotation,
              outputPath: input.output,
            }),
          onSuccess: (result) => printPdfResult(result, ctx.json),
        });
      },
    );

  command
    .command("encrypt")
    .description("Encrypt a local PDF using qpdf")
    .argument("<inputPath>", "Input PDF path")
    .option("--output <path>", "Output PDF path")
    .option("--user-password <password>", "Password used to open the PDF")
    .option("--owner-password <password>", "Password used for the PDF owner")
    .option("--bits <bits>", "Encryption strength: 40, 128, or 256", (value) => Number.parseInt(value, 10), 256)
    .action(
      async (
        inputPath: string,
        input: { output?: string; userPassword?: string; ownerPassword?: string; bits: number },
        cmd: Command,
      ) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Encrypting PDF...");
        await runCommandAction({
          spinner,
          successMessage: "PDF encrypted.",
          action: () =>
            pdfEditorAdapter.encrypt({
              inputPath,
              outputPath: input.output,
              userPassword: input.userPassword,
              ownerPassword: input.ownerPassword,
              bits: input.bits as 40 | 128 | 256,
            }),
          onSuccess: (result) => printPdfResult(result, ctx.json),
        });
      },
    );

  command
    .command("decrypt")
    .description("Decrypt a local PDF using qpdf")
    .argument("<inputPath>", "Input PDF path")
    .option("--output <path>", "Output PDF path")
    .option("--password <password>", "Password for opening the encrypted PDF")
    .action(async (inputPath: string, input: { output?: string; password?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Decrypting PDF...");
      await runCommandAction({
        spinner,
        successMessage: "PDF decrypted.",
        action: () =>
          pdfEditorAdapter.decrypt({
            inputPath,
            outputPath: input.output,
            password: input.password,
          }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  command
    .command("optimize")
    .alias("compress")
    .description("Optimize/compress a local PDF using qpdf")
    .argument("<inputPath>", "Input PDF path")
    .option("--output <path>", "Output PDF path")
    .action(async (inputPath: string, input: { output?: string }, cmd: Command) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Optimizing PDF...");
      await runCommandAction({
        spinner,
        successMessage: "PDF optimized.",
        action: () =>
          pdfEditorAdapter.optimize({
            inputPath,
            outputPath: input.output,
          }),
        onSuccess: (result) => printPdfResult(result, ctx.json),
      });
    });

  return command;
}

export const pdfPlatformDefinition: PlatformDefinition = {
  id: "pdf" as PlatformDefinition["id"],
  category: "editor",
  displayName: "PDF Editor",
  description: "Edit local PDF files using qpdf and pdf-lib",
  authStrategies: ["none"],
  buildCommand: buildPdfCommand,
  adapter: pdfEditorAdapter,
  examples: EXAMPLES,
};
