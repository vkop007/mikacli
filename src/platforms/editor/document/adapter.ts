import { spawn } from "node:child_process";
import { mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, parse, resolve } from "node:path";

import { ensureParentDirectory } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";
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

type DocumentOcrInput = {
  inputPath: string;
  output?: string;
  language?: string;
  psm?: number | string;
};

type DocumentFormat = "txt" | "rtf" | "rtfd" | "html" | "doc" | "docx" | "odt" | "wordml" | "webarchive" | "md";

const TEXTUTIL_BIN = process.env.MIKACLI_TEXTUTIL_BIN || "textutil";
const MDLS_BIN = process.env.MIKACLI_MDLS_BIN || "mdls";
const PDFTOTEXT_BIN = process.env.MIKACLI_PDFTOTEXT_BIN || "pdftotext";
const TESSERACT_BIN = process.env.MIKACLI_TESSERACT_BIN || "tesseract";
const QLMANAGE_BIN = process.env.MIKACLI_QLMANAGE_BIN || "qlmanage";
const SIPS_BIN = process.env.MIKACLI_SIPS_BIN || "sips";

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

  async ocr(input: DocumentOcrInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const extension = extname(resolvedInput).replace(/^\./, "").toLowerCase();
    const language = normalizeOcrLanguage(input.language);
    const psm = normalizePageSegmentationMode(input.psm);
    const outputPath = resolveEditorOutputPath({
      inputPath: resolvedInput,
      output: input.output,
      suffix: "ocr",
      extension: "txt",
    });

    let text = "";
    let engine = "tesseract";

    if (looksLikeTextDocument(extension)) {
      text = await extractPlainText(resolvedInput);
      if (text.trim().length > 0) {
        engine = "native-extract";
      }
    }

    if (text.trim().length === 0) {
      const ocrInputPath = await prepareOcrInput(resolvedInput);
      try {
        text = await runTesseract(ocrInputPath, language, psm);
      } finally {
        if (ocrInputPath !== resolvedInput) {
          await rm(parse(ocrInputPath).dir, { recursive: true, force: true });
        }
      }
      engine = "tesseract";
    }

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, normalizeOcrText(text), "utf8");

    return this.buildResult({
      action: "ocr",
      message: `Extracted text from ${basename(resolvedInput)} to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        format: "txt",
        characters: text.length,
        engine,
        language,
        psm,
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

  throw new MikaCliError("EDITOR_INVALID_ARGUMENT", `Unsupported document format "${value}".`, {
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
    if (error instanceof MikaCliError && error.code === "DOCUMENT_PDF_TEXT_UNAVAILABLE") {
      throw new MikaCliError(
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

function looksLikeTextDocument(extension: string): boolean {
  return ["txt", "rtf", "rtfd", "html", "doc", "docx", "odt", "wordml", "webarchive", "md", "pdf"].includes(extension);
}

function normalizeOcrLanguage(value: string | undefined): string {
  const normalized = value?.trim() || "eng";
  if (!/^[A-Za-z0-9+_-]+$/.test(normalized)) {
    throw new MikaCliError("EDITOR_INVALID_ARGUMENT", `Invalid OCR language "${value}".`);
  }

  return normalized;
}

function normalizePageSegmentationMode(value: number | string | undefined): number {
  if (value === undefined) {
    return 3;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 13) {
    throw new MikaCliError("EDITOR_INVALID_ARGUMENT", `Invalid OCR page segmentation mode "${value}". Use an integer from 0 to 13.`);
  }

  return parsed;
}

async function prepareOcrInput(inputPath: string): Promise<string> {
  const extension = extname(inputPath).replace(/^\./, "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"].includes(extension)) {
    return inputPath;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "mikacli-document-ocr-"));
  const outputPath = join(tempDir, `${parse(inputPath).name}.preview.png`);
  await renderDocumentPreview(inputPath, outputPath);
  return outputPath;
}

async function renderDocumentPreview(inputPath: string, outputPath: string): Promise<void> {
  if (await commandExists(QLMANAGE_BIN)) {
    const tempDir = await mkdtemp(join(tmpdir(), "mikacli-document-preview-"));
    const previewPath = join(tempDir, `${parse(inputPath).base}.png`);

    try {
      await runEditorBinary({
        command: QLMANAGE_BIN,
        args: ["-t", "-s", "2048", "-o", tempDir, inputPath],
        missingCode: "DOCUMENT_PREVIEW_TOOL_MISSING",
        missingMessage: "qlmanage is not installed or not available in PATH.",
        failureCode: "DOCUMENT_PREVIEW_FAILED",
        failureMessage: "Failed to render a document preview for OCR.",
      });
      await ensureParentDirectory(outputPath);
      await rename(previewPath, outputPath);
      return;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  await runEditorBinary({
    command: SIPS_BIN,
    args: ["-s", "format", "png", inputPath, "--out", outputPath],
    missingCode: "DOCUMENT_PREVIEW_TOOL_MISSING",
    missingMessage: "Neither qlmanage nor sips is available in PATH for OCR previews.",
    failureCode: "DOCUMENT_PREVIEW_FAILED",
    failureMessage: "Failed to render a document preview for OCR.",
  });
}

async function runTesseract(inputPath: string, language: string, psm: number): Promise<string> {
  const imageBuffer = await readFile(inputPath);

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(TESSERACT_BIN, ["stdin", "stdout", "-l", language, "--psm", String(psm)], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      rejectPromise(
        new MikaCliError("DOCUMENT_OCR_UNAVAILABLE", "tesseract is not installed or not available in PATH.", {
          details: {
            command: TESSERACT_BIN,
          },
          cause: error,
        }),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }

      rejectPromise(
        new MikaCliError("DOCUMENT_OCR_FAILED", "Failed to run OCR on the document preview.", {
          details: {
            command: TESSERACT_BIN,
            args: ["stdin", "stdout", "-l", language, "--psm", String(psm)],
            stdout: stdout.trim() || null,
            stderr: stderr.trim() || null,
          },
        }),
      );
    });

    child.stdin.end(imageBuffer);
  });
}

function normalizeOcrText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u000c/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, ["-h"], {
      env: process.env,
      stdio: ["ignore", "ignore", "ignore"],
    });

    child.on("error", () => resolvePromise(false));
    child.on("close", () => resolvePromise(true));
  });
}
