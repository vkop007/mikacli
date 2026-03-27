import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { pdfEditorAdapter } from "./adapter.js";
import { printPdfResult } from "./output.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "autocli pdf info ./document.pdf",
  "autocli pdf merge ./out.pdf ./a.pdf ./b.pdf",
  "autocli pdf split ./book.pdf --output-dir ./pages",
  'autocli pdf extract-pages ./book.pdf --pages "1,3-5" --output ./excerpt.pdf',
  "autocli pdf rotate ./book.pdf --angle 90 --pages 1-3 --output ./book-rotated.pdf",
  "autocli pdf encrypt ./book.pdf --output ./book-encrypted.pdf",
  "autocli pdf decrypt ./book-encrypted.pdf --output ./book-decrypted.pdf --password secret",
  "autocli pdf compress ./book.pdf --output ./book-optimized.pdf",
  "autocli pdf optimize ./book.pdf --output ./book-optimized.pdf",
] as const;

function buildPdfCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("pdf").description("Edit local PDF files using qpdf");
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
  description: "Edit local PDF files using qpdf",
  authStrategies: ["none"],
  buildCommand: buildPdfCommand,
  adapter: pdfEditorAdapter,
  examples: EXAMPLES,
};
