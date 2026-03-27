import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join, parse, resolve } from "node:path";

import { ensureParentDirectory } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type PdfInfoInput = {
  inputPath: string;
};

type PdfMergeInput = {
  outputPath: string;
  inputPaths: string[];
};

type PdfSplitInput = {
  inputPath: string;
  fromPage?: number;
  toPage?: number;
  outputDir?: string;
  prefix?: string;
};

type PdfExtractPagesInput = {
  inputPath: string;
  pages: string;
  outputPath: string;
};

type PdfRotateInput = {
  inputPath: string;
  angle: number;
  pages?: string;
  outputPath?: string;
};

type PdfEncryptInput = {
  inputPath: string;
  outputPath?: string;
  userPassword?: string;
  ownerPassword?: string;
  bits?: PdfEncryptionBits;
};

type PdfDecryptInput = {
  inputPath: string;
  outputPath?: string;
  password?: string;
};

type PdfOptimizeInput = {
  inputPath: string;
  outputPath?: string;
};

type PdfEncryptionBits = 40 | 128 | 256;

type PdfInfo = {
  pages: number;
  encrypted: boolean;
  encryptionSummary?: string;
  sizeBytes: number;
};

const QPDF_BIN = process.env.AUTOCLI_QPDF_BIN || "qpdf";

export class PdfEditorAdapter {
  readonly platform: Platform = "pdf" as unknown as Platform;
  readonly displayName = "PDF Editor";

  async info(input: PdfInfoInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const info = await readPdfInfo(resolvedInput);

    return this.buildResult({
      action: "info",
      message: `Loaded PDF info for ${parse(resolvedInput).base}.`,
      data: {
        inputPath: resolvedInput,
        pages: info.pages,
        encrypted: info.encrypted,
        encryptionSummary: info.encryptionSummary ?? null,
        sizeBytes: info.sizeBytes,
      },
    });
  }

  async merge(input: PdfMergeInput): Promise<AdapterActionResult> {
    if (input.inputPaths.length < 2) {
      throw new AutoCliError("PDF_MERGE_NEEDS_INPUTS", "Merge needs at least two input PDFs.");
    }

    const outputPath = resolve(input.outputPath);
    await ensureParentDirectory(outputPath);

    const inputPaths = await Promise.all(input.inputPaths.map((value) => assertReadableFile(value)));
    const args = ["--empty", "--pages", ...inputPaths.flatMap((file) => [file, "1-z"]), "--", outputPath];
    await runQpdf(args);

    return this.buildResult({
      action: "merge",
      message: `Merged ${inputPaths.length} PDFs into ${outputPath}.`,
      data: {
        outputPath,
        inputPaths,
        mergedCount: inputPaths.length,
      },
    });
  }

  async split(input: PdfSplitInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const pdfInfo = await readPdfInfo(resolvedInput);
    const startPage = clampPage(input.fromPage ?? 1, 1, pdfInfo.pages);
    const endPage = clampPage(input.toPage ?? pdfInfo.pages, startPage, pdfInfo.pages);
    const outputDir = resolve(input.outputDir ?? parse(resolvedInput).dir);
    const prefix = normalizePrefix(input.prefix ?? parse(resolvedInput).name);

    const outputPaths: string[] = [];
    for (let page = startPage; page <= endPage; page += 1) {
      const outputPath = join(outputDir, `${prefix}.page-${String(page).padStart(3, "0")}.pdf`);
      await ensureParentDirectory(outputPath);
      await runQpdf(["--empty", "--pages", resolvedInput, `${page}-${page}`, "--", outputPath]);
      outputPaths.push(outputPath);
    }

    return this.buildResult({
      action: "split",
      message: `Split ${endPage - startPage + 1} pages from ${resolvedInput}.`,
      data: {
        inputPath: resolvedInput,
        outputDir,
        prefix,
        fromPage: startPage,
        toPage: endPage,
        outputPaths,
      },
    });
  }

  async extractPages(input: PdfExtractPagesInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath);
    await ensureParentDirectory(outputPath);

    const ranges = parsePageSpec(input.pages);
    if (ranges.length === 0) {
      throw new AutoCliError("PDF_PAGES_REQUIRED", "At least one page range is required.");
    }

    const pageArgs = ranges.flatMap((range) => [resolvedInput, `${range.start}-${range.end}`]);
    await runQpdf(["--empty", "--pages", ...pageArgs, "--", outputPath]);

    return this.buildResult({
      action: "extract-pages",
      message: `Extracted ${describeRanges(ranges)} to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        pages: input.pages,
        ranges,
      },
    });
  }

  async rotate(input: PdfRotateInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".rotated.pdf"));
    await ensureParentDirectory(outputPath);

    const rotation = normalizeRotationAngle(input.angle);
    const pageSpec = input.pages ? buildQpdfPageRange(parsePageSpec(input.pages)) : undefined;
    const args = buildRotateArgs({
      inputPath: resolvedInput,
      outputPath,
      angle: rotation,
      pageSpec,
    });
    await runQpdf(args);

    return this.buildResult({
      action: "rotate",
      message: `Rotated ${parse(resolvedInput).base} by ${rotation}${pageSpec ? ` on ${pageSpec}` : ""}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        angle: rotation,
        pageSpec: pageSpec ?? null,
      },
    });
  }

  async encrypt(input: PdfEncryptInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".encrypted.pdf"));
    await ensureParentDirectory(outputPath);

    const bits = normalizeEncryptionBits(input.bits ?? 256);
    const userPassword = normalizePassword(input.userPassword ?? "autocli") ?? "autocli";
    const ownerPassword = normalizePassword(input.ownerPassword ?? generatePassword()) ?? generatePassword();
    const args = buildEncryptArgs({
      inputPath: resolvedInput,
      outputPath,
      userPassword,
      ownerPassword,
      bits,
    });
    await runQpdf(args);

    return this.buildResult({
      action: "encrypt",
      message: `Encrypted ${parse(resolvedInput).base} to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        encrypted: true,
        bits,
      },
    });
  }

  async decrypt(input: PdfDecryptInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".decrypted.pdf"));
    await ensureParentDirectory(outputPath);

    const args = buildDecryptArgs({
      inputPath: resolvedInput,
      outputPath,
      password: normalizePassword(input.password),
    });
    await runQpdf(args);

    return this.buildResult({
      action: "decrypt",
      message: `Decrypted ${parse(resolvedInput).base} to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        decrypted: true,
      },
    });
  }

  async optimize(input: PdfOptimizeInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".optimized.pdf"));
    await ensureParentDirectory(outputPath);

    const args = buildOptimizeArgs({
      inputPath: resolvedInput,
      outputPath,
    });
    await runQpdf(args);

    return this.buildResult({
      action: "optimize",
      message: `Optimized ${parse(resolvedInput).base} to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        optimized: true,
        linearized: true,
      },
    });
  }

  async compress(input: PdfOptimizeInput): Promise<AdapterActionResult> {
    return this.optimize(input);
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

export const pdfEditorAdapter = new PdfEditorAdapter();

export async function readPdfInfo(inputPath: string): Promise<PdfInfo> {
  const resolvedInput = await assertReadableFile(inputPath);
  const [pagesText, encryptionText, fileStat] = await Promise.all([
    runQpdf(["--show-npages", resolvedInput]),
    runQpdf(["--show-encryption", resolvedInput]).catch((error) => {
      if (error instanceof AutoCliError && error.code === "PDF_QPDF_NOT_AVAILABLE") {
        throw error;
      }
      return "";
    }),
    stat(resolvedInput),
  ]);

  const pages = parseInteger(pagesText.trim(), "page count");
  const encryptionSummary = normalizeOptionalString(encryptionText);
  const encrypted = /encrypted/i.test(encryptionText) && !/not encrypted/i.test(encryptionText);

  return {
    pages,
    encrypted,
    encryptionSummary,
    sizeBytes: fileStat.size,
  };
}

export function parsePageSpec(value: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const match = /^(\d+)(?:-(\d+))?$/.exec(trimmed);
    if (!match) {
      throw new AutoCliError("PDF_PAGE_SPEC_INVALID", `Invalid page spec "${value}".`, {
        details: {
          value,
        },
      });
    }

    const start = parseInteger(match[1]!, "page start");
    const end = parseInteger(match[2] ?? match[1]!, "page end");
    if (start <= 0 || end <= 0 || end < start) {
      throw new AutoCliError("PDF_PAGE_SPEC_INVALID", `Invalid page range "${trimmed}".`, {
        details: {
          value,
        },
      });
    }

    ranges.push({ start, end });
  }

  return ranges;
}

export function normalizeRotationAngle(angle: number): string {
  if (!Number.isFinite(angle)) {
    throw new AutoCliError("PDF_ROTATE_INVALID", "Rotation angle must be a finite number.");
  }

  if (angle % 90 !== 0) {
    throw new AutoCliError("PDF_ROTATE_INVALID", "Rotation angle must be a multiple of 90 degrees.", {
      details: {
        angle,
      },
    });
  }

  const normalized = ((Math.trunc(angle) % 360) + 360) % 360;
  return normalized === 0 ? "0" : `+${normalized}`;
}

export function buildRotateArgs(input: {
  inputPath: string;
  outputPath: string;
  angle: string;
  pageSpec?: string;
}): string[] {
  const rotateArg = `--rotate=${input.angle}${input.pageSpec ? `:${input.pageSpec}` : ""}`;
  return [rotateArg, input.inputPath, input.outputPath];
}

export function buildEncryptArgs(input: {
  inputPath: string;
  outputPath: string;
  userPassword: string;
  ownerPassword: string;
  bits: PdfEncryptionBits;
}): string[] {
  return [
    "--encrypt",
    input.userPassword,
    input.ownerPassword,
    String(input.bits),
    "--",
    input.inputPath,
    input.outputPath,
  ];
}

export function buildDecryptArgs(input: {
  inputPath: string;
  outputPath: string;
  password?: string;
}): string[] {
  const args = input.password ? [`--password=${input.password}`] : [];
  args.push("--decrypt", input.inputPath, input.outputPath);
  return args;
}

export function buildOptimizeArgs(input: {
  inputPath: string;
  outputPath: string;
}): string[] {
  return [
    "--linearize",
    "--object-streams=generate",
    "--stream-data=compress",
    "--recompress-flate",
    "--compression-level=9",
    input.inputPath,
    input.outputPath,
  ];
}

function normalizePrefix(value: string): string {
  const normalized = value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || "pdf";
}

function buildSiblingOutputPath(inputPath: string, suffix: string): string {
  const parsed = parse(inputPath);
  return join(parsed.dir, `${parsed.name}${suffix}`);
}

function describeRanges(ranges: Array<{ start: number; end: number }>): string {
  return ranges.map((range) => (range.start === range.end ? `page ${range.start}` : `pages ${range.start}-${range.end}`)).join(", ");
}

function clampPage(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function parseInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AutoCliError("PDF_PAGE_SPEC_INVALID", `${label} must be a positive integer.`, {
      details: {
        value,
      },
    });
  }

  return parsed;
}

function normalizeOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePassword(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEncryptionBits(value: number): PdfEncryptionBits {
  if (value === 40 || value === 128 || value === 256) {
    return value;
  }

  throw new AutoCliError("PDF_ENCRYPT_BITS_INVALID", "Encryption bits must be one of 40, 128, or 256.", {
    details: {
      value,
    },
  });
}

function generatePassword(): string {
  return randomBytes(12).toString("base64url");
}

function buildQpdfPageRange(ranges: Array<{ start: number; end: number }>): string {
  return ranges
    .map((range) => (range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`))
    .join(",");
}

async function assertReadableFile(inputPath: string): Promise<string> {
  const resolved = resolve(inputPath);
  try {
    await stat(resolved);
  } catch (error) {
    throw new AutoCliError("PDF_INPUT_NOT_FOUND", `Input file does not exist: ${inputPath}`, {
      details: {
        inputPath,
        resolvedPath: resolved,
      },
      cause: error,
    });
  }

  return resolved;
}

async function runQpdf(args: readonly string[]): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(QPDF_BIN, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
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
        new AutoCliError("PDF_QPDF_NOT_AVAILABLE", "qpdf is not installed or not available in PATH.", {
          details: {
            command: QPDF_BIN,
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
        new AutoCliError("PDF_QPDF_FAILED", `qpdf exited with code ${code}.`, {
          details: {
            command: QPDF_BIN,
            args,
            stderr: stderr.trim() || null,
            stdout: stdout.trim() || null,
          },
        }),
      );
    });
  });
}
