import { readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join, parse, resolve } from "node:path";

import { ensureParentDirectory } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

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

type PdfRemovePagesInput = {
  inputPath: string;
  pages: string;
  outputPath?: string;
};

type PdfMetadataInput = {
  inputPath: string;
  outputPath?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
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

type PdfWatermarkInput = {
  inputPath: string;
  text: string;
  outputPath?: string;
  pages?: string;
  opacity?: number | string;
  size?: number | string;
  color?: string;
  rotation?: number | string;
};

type PdfReorderPagesInput = {
  inputPath: string;
  pages: string;
  outputPath?: string;
};

type PdfEncryptionBits = 40 | 128 | 256;

type PdfInfo = {
  pages: number;
  encrypted: boolean;
  encryptionSummary?: string;
  sizeBytes: number;
};

type PdfMetadata = {
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  creator: string | null;
  producer: string | null;
  creationDate: string | null;
  modificationDate: string | null;
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

  async removePages(input: PdfRemovePagesInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".trimmed.pdf"));
    await ensureParentDirectory(outputPath);

    const pdf = await PDFDocument.load(await readFile(resolvedInput));
    const totalPages = pdf.getPageCount();
    const removedPages = expandOrderedPageSpec(input.pages, totalPages);
    const removedSet = new Set(removedPages);
    if (removedSet.size === 0) {
      throw new AutoCliError("PDF_PAGES_REQUIRED", "At least one page is required for remove-pages.");
    }

    const selectedPages = Array.from(removedSet).sort((left, right) => left - right);
    const keptPages = Array.from({ length: totalPages }, (_value, index) => index + 1).filter((page) => !removedSet.has(page));
    if (keptPages.length === 0) {
      throw new AutoCliError("PDF_REMOVE_PAGES_EMPTY", "remove-pages would remove every page from the PDF.");
    }

    const output = await PDFDocument.create();
    copyPdfMetadata(pdf, output);
    const copiedPages = await output.copyPages(
      pdf,
      keptPages.map((pageNumber) => pageNumber - 1),
    );
    for (const copiedPage of copiedPages) {
      output.addPage(copiedPage);
    }

    await writeFile(outputPath, await output.save());

    return this.buildResult({
      action: "remove-pages",
      message: `Removed ${describeRanges(rangesFromPages(selectedPages))} from ${parse(resolvedInput).base}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        pages: input.pages,
        removedPages: selectedPages,
        keptPages,
        remainingPages: keptPages,
        removedPageCount: selectedPages.length,
        keptPageCount: keptPages.length,
      },
    });
  }

  async metadata(input: PdfMetadataInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const source = await PDFDocument.load(await readFile(resolvedInput));
    const currentMetadata = readPdfMetadata(source);
    const updates = buildMetadataUpdates(input);
    const shouldWrite = updates.length > 0 || Boolean(input.outputPath);
    const writingMetadata = updates.length > 0;

    if (!shouldWrite) {
      return this.buildResult({
        action: "metadata",
        message: `Inspected metadata for ${parse(resolvedInput).base}.`,
        data: {
          inputPath: resolvedInput,
          updated: false,
          updatedFields: [],
          metadata: currentMetadata,
        },
      });
    }

    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".metadata.pdf"));
    await ensureParentDirectory(outputPath);

    applyMetadataUpdates(source, input);
    await writeFile(outputPath, await source.save());

    return this.buildResult({
      action: "metadata",
      message: writingMetadata
        ? `Updated metadata for ${parse(resolvedInput).base} and saved to ${outputPath}.`
        : `Saved a copy of ${parse(resolvedInput).base} to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        updated: writingMetadata,
        updatedFields: updates,
        metadata: readPdfMetadata(source),
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

  async watermark(input: PdfWatermarkInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".watermarked.pdf"));
    await ensureParentDirectory(outputPath);

    const pdf = await PDFDocument.load(await readFile(resolvedInput));
    const pages = pdf.getPages();
    const targets = expandPageTargets(input.pages, pages.length);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const size = clampPositiveNumber(input.size, 42, "size");
    const opacity = clampBetween(input.opacity, 0.08, 0.05, 1, "opacity");
    const rotation = toFiniteNumber(input.rotation, 315);
    const color = parsePdfColor(input.color);

    for (const pageNumber of targets) {
      const page = pages[pageNumber - 1];
      if (!page) {
        continue;
      }

      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const textWidth = font.widthOfTextAtSize(input.text, size);

      page.drawText(input.text, {
        x: Math.max(24, (pageWidth - textWidth) / 2),
        y: Math.max(24, pageHeight / 2),
        size,
        font,
        rotate: degrees(rotation),
        opacity,
        color,
      });
    }

    await writeFile(outputPath, await pdf.save());

    return this.buildResult({
      action: "watermark",
      message: `Applied a text watermark to ${parse(resolvedInput).base}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        text: input.text,
        pages: targets,
        opacity,
        size,
        rotation,
        color: input.color?.trim() || "#808080",
      },
    });
  }

  async reorderPages(input: PdfReorderPagesInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertReadableFile(input.inputPath);
    const outputPath = resolve(input.outputPath ?? buildSiblingOutputPath(resolvedInput, ".reordered.pdf"));
    await ensureParentDirectory(outputPath);

    const source = await PDFDocument.load(await readFile(resolvedInput));
    const pageOrder = expandOrderedPageSpec(input.pages, source.getPageCount());
    if (pageOrder.length === 0) {
      throw new AutoCliError("PDF_PAGES_REQUIRED", "At least one target page is required for reorder-pages.");
    }

    const destination = await PDFDocument.create();
    copyPdfMetadata(source, destination);
    const copiedPages = await destination.copyPages(
      source,
      pageOrder.map((pageNumber) => pageNumber - 1),
    );
    for (const copiedPage of copiedPages) {
      destination.addPage(copiedPage);
    }

    await writeFile(outputPath, await destination.save());

    return this.buildResult({
      action: "reorder-pages",
      message: `Reordered ${pageOrder.length} pages into ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        pages: pageOrder,
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

function clampPositiveNumber(value: number | string | undefined, fallback: number, label: string): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} must be a positive number.`, {
      details: {
        label,
        value,
      },
    });
  }

  return parsed;
}

function clampBetween(
  value: number | string | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} must be between ${min} and ${max}.`, {
      details: {
        label,
        value,
      },
    });
  }

  return parsed;
}

function toFiniteNumber(value: number | string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Value must be a finite number.", {
      details: {
        value,
      },
    });
  }

  return parsed;
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

function readPdfMetadata(pdf: PDFDocument): PdfMetadata {
  return {
    title: normalizeMetadataString(pdf.getTitle()),
    author: normalizeMetadataString(pdf.getAuthor()),
    subject: normalizeMetadataString(pdf.getSubject()),
    keywords: normalizeMetadataKeywords(pdf.getKeywords()),
    creator: normalizeMetadataString(pdf.getCreator()),
    producer: normalizeMetadataString(pdf.getProducer()),
    creationDate: formatMetadataDate(pdf.getCreationDate()),
    modificationDate: formatMetadataDate(pdf.getModificationDate()),
  };
}

function applyMetadataUpdates(pdf: PDFDocument, input: PdfMetadataInput): void {
  const title = normalizeMetadataString(input.title);
  if (title !== null) {
    pdf.setTitle(title);
  }

  const author = normalizeMetadataString(input.author);
  if (author !== null) {
    pdf.setAuthor(author);
  }

  const subject = normalizeMetadataString(input.subject);
  if (subject !== null) {
    pdf.setSubject(subject);
  }

  const keywords = normalizeMetadataKeywordsInput(input.keywords);
  if (keywords !== undefined) {
    pdf.setKeywords(keywords);
  }

  const creator = normalizeMetadataString(input.creator);
  if (creator !== null) {
    pdf.setCreator(creator);
  }

  const producer = normalizeMetadataString(input.producer);
  if (producer !== null) {
    pdf.setProducer(producer);
  }

  const creationDate = normalizeMetadataDate(input.creationDate);
  if (creationDate !== undefined) {
    pdf.setCreationDate(creationDate);
  }

  const modificationDate = normalizeMetadataDate(input.modificationDate);
  if (modificationDate !== undefined) {
    pdf.setModificationDate(modificationDate);
  }
}

function buildMetadataUpdates(input: PdfMetadataInput): string[] {
  const updates: string[] = [];
  if (normalizeMetadataString(input.title) !== null) updates.push("title");
  if (normalizeMetadataString(input.author) !== null) updates.push("author");
  if (normalizeMetadataString(input.subject) !== null) updates.push("subject");
  if (normalizeMetadataKeywordsInput(input.keywords) !== undefined) updates.push("keywords");
  if (normalizeMetadataString(input.creator) !== null) updates.push("creator");
  if (normalizeMetadataString(input.producer) !== null) updates.push("producer");
  if (normalizeMetadataDate(input.creationDate) !== undefined) updates.push("creationDate");
  if (normalizeMetadataDate(input.modificationDate) !== undefined) updates.push("modificationDate");
  return updates;
}

function normalizeMetadataString(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMetadataKeywords(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMetadataKeywordsInput(value: string | undefined): string[] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function splitMetadataKeywords(value: string): string[] {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

function normalizeMetadataDate(value: string | undefined): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Invalid date value "${value}".`, {
      details: {
        value,
      },
    });
  }

  return parsed;
}

function formatMetadataDate(value: Date | undefined): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

function copyPdfMetadata(source: PDFDocument, destination: PDFDocument): void {
  const metadata = readPdfMetadata(source);
  if (metadata.title !== null) destination.setTitle(metadata.title);
  if (metadata.author !== null) destination.setAuthor(metadata.author);
  if (metadata.subject !== null) destination.setSubject(metadata.subject);
  if (metadata.keywords !== null) destination.setKeywords(splitMetadataKeywords(metadata.keywords));
  if (metadata.creator !== null) destination.setCreator(metadata.creator);
  if (metadata.producer !== null) destination.setProducer(metadata.producer);
  if (metadata.creationDate !== null) destination.setCreationDate(new Date(metadata.creationDate));
  if (metadata.modificationDate !== null) destination.setModificationDate(new Date(metadata.modificationDate));
}

function rangesFromPages(pages: number[]): Array<{ start: number; end: number }> {
  if (pages.length === 0) {
    return [];
  }

  const sorted = [...pages].sort((left, right) => left - right);
  const ranges: Array<{ start: number; end: number }> = [];
  let start = sorted[0]!;
  let end = start;

  for (let index = 1; index < sorted.length; index += 1) {
    const page = sorted[index]!;
    if (page === end + 1) {
      end = page;
      continue;
    }

    ranges.push({ start, end });
    start = page;
    end = page;
  }

  ranges.push({ start, end });
  return ranges;
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

function expandOrderedPageSpec(value: string, totalPages: number): number[] {
  const pages: number[] = [];
  for (const range of parsePageSpec(value)) {
    for (let page = range.start; page <= range.end; page += 1) {
      if (page > totalPages) {
        throw new AutoCliError("PDF_PAGE_SPEC_INVALID", `Page ${page} is outside the PDF page count (${totalPages}).`, {
          details: {
            value,
            totalPages,
          },
        });
      }
      pages.push(page);
    }
  }
  return pages;
}

function expandPageTargets(value: string | undefined, totalPages: number): number[] {
  if (!value) {
    return Array.from({ length: totalPages }, (_value, index) => index + 1);
  }
  return expandOrderedPageSpec(value, totalPages);
}

function expandPageNumberSet(value: string, totalPages: number): Set<number> {
  const pages = new Set<number>();
  for (const range of parsePageSpec(value)) {
    for (let page = range.start; page <= range.end; page += 1) {
      if (page > totalPages) {
        throw new AutoCliError("PDF_PAGE_SPEC_INVALID", `Page ${page} is outside the PDF page count (${totalPages}).`, {
          details: {
            value,
            totalPages,
          },
        });
      }
      pages.add(page);
    }
  }
  return pages;
}

function parsePdfColor(value: string | undefined): ReturnType<typeof rgb> {
  const normalized = value?.trim() || "#808080";
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported PDF color "${value}".`, {
      details: {
        supportedFormats: ["#RRGGBB"],
      },
    });
  }

  const red = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(hex.slice(4, 6), 16) / 255;
  return rgb(red, green, blue);
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
