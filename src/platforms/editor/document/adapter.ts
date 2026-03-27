import { stat, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import { ensureParentDirectory } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";
import { assertLocalInputFile, normalizeOutputExtension, resolveEditorOutputPath } from "../shared/ffmpeg.js";
import { runEditorBinary } from "../shared/process.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type DocumentInfoInput = {
  inputPath: string;
};

type DocumentConvertInput = {
  inputPath: string;
  to: string;
  output?: string;
};

type DocumentExtractTextInput = {
  inputPath: string;
  output?: string;
};

type DocumentMetadataInput = {
  inputPath: string;
};

type DocumentFormat = "txt" | "rtf" | "rtfd" | "html" | "doc" | "docx" | "odt" | "wordml" | "webarchive" | "md";

const TEXTUTIL_BIN = process.env.AUTOCLI_TEXTUTIL_BIN || "textutil";
const MDLS_BIN = process.env.AUTOCLI_MDLS_BIN || "mdls";
const PDFTOTEXT_BIN = process.env.AUTOCLI_PDFTOTEXT_BIN || "pdftotext";

export class DocumentEditorAdapter {
  readonly platform: Platform = "document" as unknown as Platform;
  readonly displayName = "Document Editor";

  async info(input: DocumentInfoInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const fileStat = await stat(resolvedInput);
    const metadata = await readTextutilInfo(resolvedInput).catch(() => ({}));

    return this.buildResult({
      action: "info",
      message: `Loaded document info for ${basename(resolvedInput)}.`,
      data: {
        inputPath: resolvedInput,
        sizeBytes: fileStat.size,
        extension: extname(resolvedInput).replace(/^\./, "") || null,
        metadata,
      },
    });
  }

  async convert(input: DocumentConvertInput): Promise<AdapterActionResult> {
    const format = normalizeDocumentFormat(input.to);
    if (format === "md") {
      return this.toMarkdown({ inputPath: input.inputPath, output: input.output });
    }

    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const outputPath = resolveEditorOutputPath({
      inputPath: resolvedInput,
      output: input.output,
      suffix: "converted",
      extension: format,
    });

    await ensureParentDirectory(outputPath);
    await runTextutil(["-convert", format, resolvedInput, "-output", outputPath]);

    return this.buildResult({
      action: "convert",
      message: `Converted document to ${format} at ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        format,
      },
    });
  }

  async extractText(input: DocumentExtractTextInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const text = await extractPlainText(resolvedInput);
    const outputPath = resolveEditorOutputPath({
      inputPath: resolvedInput,
      output: input.output,
      suffix: "text",
      extension: "txt",
    });

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, text, "utf8");

    return this.buildResult({
      action: "extract-text",
      message: `Extracted plain text to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        format: "txt",
        characters: text.length,
      },
    });
  }

  async toMarkdown(input: DocumentExtractTextInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const text = await extractPlainText(resolvedInput);
    const markdown = convertTextToMarkdown(text);
    const outputPath = resolveEditorOutputPath({
      inputPath: resolvedInput,
      output: input.output,
      suffix: "markdown",
      extension: "md",
    });

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, markdown, "utf8");

    return this.buildResult({
      action: "to-markdown",
      message: `Converted document text to Markdown at ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        format: "md",
        characters: markdown.length,
      },
    });
  }

  async metadata(input: DocumentMetadataInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const metadata = await readMdlsMetadata(resolvedInput);

    return this.buildResult({
      action: "metadata",
      message: `Loaded document metadata for ${basename(resolvedInput)}.`,
      data: {
        inputPath: resolvedInput,
        metadata,
      },
    });
  }

  private buildResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const documentEditorAdapter = new DocumentEditorAdapter();

export function normalizeDocumentFormat(value: string): DocumentFormat {
  const normalized = normalizeOutputExtension(value);
  if (["txt", "rtf", "rtfd", "html", "doc", "docx", "odt", "wordml", "webarchive", "md"].includes(normalized)) {
    return normalized as DocumentFormat;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported document format "${value}".`, {
    details: {
      supportedFormats: ["txt", "rtf", "rtfd", "html", "doc", "docx", "odt", "wordml", "webarchive", "md"],
    },
  });
}

export function parseMdlsOutput(value: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const match = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }

    metadata[match[1]!] = match[2]!;
  }
  return metadata;
}

async function extractPlainText(inputPath: string): Promise<string> {
  const extension = extname(inputPath).replace(/^\./, "").toLowerCase();
  if (extension === "pdf") {
    return extractPdfText(inputPath);
  }

  const { stdout } = await runTextutil(["-convert", "txt", "-stdout", inputPath]);
  return stdout;
}

async function extractPdfText(inputPath: string): Promise<string> {
  const resolvedInput = await assertLocalInputFile(inputPath);
  try {
    const { stdout } = await runEditorBinary({
      command: PDFTOTEXT_BIN,
      args: ["-layout", resolvedInput, "-"],
      missingCode: "DOCUMENT_PDF_TEXT_UNAVAILABLE",
      missingMessage: "pdftotext is not installed or not available in PATH.",
      failureCode: "DOCUMENT_PDF_TEXT_FAILED",
      failureMessage: "Failed to extract text from the PDF document.",
    });
    return stdout;
  } catch (error) {
    if (error instanceof AutoCliError && error.code === "DOCUMENT_PDF_TEXT_UNAVAILABLE") {
      throw new AutoCliError(
        "DOCUMENT_PDF_TEXT_UNAVAILABLE",
        "PDF text extraction needs `pdftotext`. Install it or convert the PDF separately first.",
        { cause: error },
      );
    }
    throw error;
  }
}

async function readTextutilInfo(inputPath: string): Promise<Record<string, string>> {
  const { stdout } = await runTextutil(["-info", inputPath]);
  const metadata: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const match = /^([^:]+):\s*(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    metadata[match[1]!.trim()] = match[2]!.trim();
  }
  return metadata;
}

async function readMdlsMetadata(inputPath: string): Promise<Record<string, string>> {
  const { stdout } = await runEditorBinary({
    command: MDLS_BIN,
    args: [inputPath],
    missingCode: "DOCUMENT_METADATA_TOOL_MISSING",
    missingMessage: "mdls is not installed or not available in PATH.",
    failureCode: "DOCUMENT_METADATA_FAILED",
    failureMessage: "Failed to read document metadata.",
  });
  return parseMdlsOutput(stdout);
}

async function runTextutil(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return runEditorBinary({
    command: TEXTUTIL_BIN,
    args: [...args],
    missingCode: "DOCUMENT_TEXTUTIL_MISSING",
    missingMessage: "textutil is not installed or not available in PATH.",
    failureCode: "DOCUMENT_TEXTUTIL_FAILED",
    failureMessage: "Failed to process the document with textutil.",
  });
}

function convertTextToMarkdown(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}
