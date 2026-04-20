import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";

import { ensureParentDirectory } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";
import { assertLocalInputFile, normalizeOutputExtension } from "../shared/ffmpeg.js";
import { runEditorBinary } from "../shared/process.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type ArchiveInfoInput = {
  inputPath: string;
};

type ArchiveListInput = {
  inputPath: string;
};

type ArchiveCreateInput = {
  outputPath: string;
  inputPaths: string[];
  format?: string;
};

type ArchiveExtractInput = {
  inputPath: string;
  outputDir?: string;
};

type ArchiveGzipInput = {
  inputPath: string;
  output?: string;
};

type ArchiveGunzipInput = {
  inputPath: string;
  output?: string;
};

type ArchiveFormat = "zip" | "tar" | "tar.gz" | "tgz" | "gz" | "7z";

const ZIP_BIN = process.env.MIKACLI_ZIP_BIN || "zip";
const UNZIP_BIN = process.env.MIKACLI_UNZIP_BIN || "unzip";
const TAR_BIN = process.env.MIKACLI_TAR_BIN || "tar";
const GZIP_BIN = process.env.MIKACLI_GZIP_BIN || "gzip";
const GUNZIP_BIN = process.env.MIKACLI_GUNZIP_BIN || "gunzip";
const SEVEN_Z_BIN = process.env.MIKACLI_7Z_BIN || "7z";

export class ArchiveEditorAdapter {
  readonly platform: Platform = "archive" as unknown as Platform;
  readonly displayName = "Archive Editor";

  async info(input: ArchiveInfoInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const fileStat = await stat(resolvedInput);
    const format = detectArchiveFormat(resolvedInput);
    const entries = format === "gz" ? [basename(resolvedInput).replace(/\.gz$/i, "")] : await this.listEntries(resolvedInput, format);

    return this.buildResult({
      action: "info",
      message: `Loaded archive info for ${basename(resolvedInput)}.`,
      data: {
        inputPath: resolvedInput,
        format,
        sizeBytes: fileStat.size,
        entryCount: entries.length,
      },
    });
  }

  async list(input: ArchiveListInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const format = detectArchiveFormat(resolvedInput);
    const entries = format === "gz" ? [basename(resolvedInput).replace(/\.gz$/i, "")] : await this.listEntries(resolvedInput, format);

    return this.buildResult({
      action: "list",
      message: `Listed ${entries.length} archive entries from ${basename(resolvedInput)}.`,
      data: {
        inputPath: resolvedInput,
        format,
        entries,
        entryCount: entries.length,
      },
    });
  }

  async create(input: ArchiveCreateInput): Promise<AdapterActionResult> {
    if (input.inputPaths.length === 0) {
      throw new MikaCliError("EDITOR_INVALID_ARGUMENT", "Archive create needs at least one input path.");
    }

    const resolvedInputs = await Promise.all(input.inputPaths.map((inputPath) => assertLocalInputFile(inputPath)));
    const commandInputs = input.inputPaths.map((inputPath, index) => toArchiveCreateArg(inputPath, resolvedInputs[index]!));
    const outputPath = resolve(input.outputPath);
    const format = normalizeArchiveFormat(input.format ?? detectArchiveFormat(outputPath));
    await ensureParentDirectory(outputPath);

    switch (format) {
      case "zip":
        await runZip(["-r", outputPath, ...commandInputs]);
        break;
      case "tar":
        await runTar(["-cf", outputPath, ...commandInputs]);
        break;
      case "tar.gz":
      case "tgz":
        await runTar(["-czf", outputPath, ...commandInputs]);
        break;
      case "7z":
        await runSevenZip(["a", outputPath, ...commandInputs]);
        break;
      case "gz":
        if (resolvedInputs.length !== 1) {
          throw new MikaCliError("EDITOR_INVALID_ARGUMENT", "Gzip archive creation only supports one input file.");
        }
        return this.gzip({
          inputPath: resolvedInputs[0]!,
          output: outputPath,
        });
    }

    return this.buildResult({
      action: "create",
      message: `Created ${format} archive at ${outputPath}.`,
      data: {
        outputPath,
        format,
        inputPaths: resolvedInputs,
        inputCount: resolvedInputs.length,
      },
    });
  }

  async extract(input: ArchiveExtractInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const format = detectArchiveFormat(resolvedInput);
    const outputDir = resolve(input.outputDir ?? `${resolvedInput}.extracted`);
    await mkdir(outputDir, { recursive: true });

    switch (format) {
      case "zip":
        await runUnzip(["-o", resolvedInput, "-d", outputDir]);
        break;
      case "tar":
      case "tar.gz":
      case "tgz":
        await runTar(["-xf", resolvedInput, "-C", outputDir]);
        break;
      case "7z":
        await runSevenZip(["x", "-y", `-o${outputDir}`, resolvedInput]);
        break;
      case "gz": {
        const outputPath = resolve(outputDir, basename(resolvedInput).replace(/\.gz$/i, ""));
        await this.gunzip({
          inputPath: resolvedInput,
          output: outputPath,
        });
        return this.buildResult({
          action: "extract",
          message: `Extracted gzip file to ${outputPath}.`,
          data: {
            inputPath: resolvedInput,
            outputDir,
            outputPath,
            format,
          },
        });
      }
    }

    return this.buildResult({
      action: "extract",
      message: `Extracted archive into ${outputDir}.`,
      data: {
        inputPath: resolvedInput,
        outputDir,
        format,
      },
    });
  }

  async gzip(input: ArchiveGzipInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const outputPath = resolve(input.output ?? `${resolvedInput}.gz`);
    await ensureParentDirectory(outputPath);
    await pipeBinaryToFile({
      command: GZIP_BIN,
      args: ["-c", resolvedInput],
      outputPath,
      missingCode: "ARCHIVE_GZIP_NOT_AVAILABLE",
      missingMessage: "gzip is not installed or not available in PATH.",
      failureCode: "ARCHIVE_GZIP_FAILED",
      failureMessage: "Failed to gzip the file.",
    });

    return this.buildResult({
      action: "gzip",
      message: `Compressed file to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        format: "gz",
      },
    });
  }

  async gunzip(input: ArchiveGunzipInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const outputPath = resolve(input.output ?? resolvedInput.replace(/\.gz$/i, ""));
    await ensureParentDirectory(outputPath);
    await pipeBinaryToFile({
      command: GUNZIP_BIN,
      args: ["-c", resolvedInput],
      outputPath,
      missingCode: "ARCHIVE_GUNZIP_NOT_AVAILABLE",
      missingMessage: "gunzip is not installed or not available in PATH.",
      failureCode: "ARCHIVE_GUNZIP_FAILED",
      failureMessage: "Failed to gunzip the file.",
    });

    return this.buildResult({
      action: "gunzip",
      message: `Decompressed file to ${outputPath}.`,
      data: {
        inputPath: resolvedInput,
        outputPath,
        format: detectArchiveFormat(resolvedInput),
      },
    });
  }

  private async listEntries(inputPath: string, format: Exclude<ArchiveFormat, "gz">): Promise<string[]> {
    switch (format) {
      case "zip": {
        const { stdout } = await runUnzip(["-Z1", inputPath]);
        return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
      }
      case "tar":
      case "tar.gz":
      case "tgz": {
        const { stdout } = await runTar(["-tf", inputPath]);
        return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
      }
      case "7z": {
        const { stdout } = await runSevenZip(["l", "-ba", inputPath]);
        return stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.split(/\s+/).at(-1) ?? line);
      }
    }
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

export const archiveEditorAdapter = new ArchiveEditorAdapter();

export function detectArchiveFormat(inputPath: string): ArchiveFormat {
  const lower = inputPath.toLowerCase();
  if (lower.endsWith(".tar.gz")) {
    return "tar.gz";
  }
  if (lower.endsWith(".tgz")) {
    return "tgz";
  }
  if (lower.endsWith(".tar")) {
    return "tar";
  }
  if (lower.endsWith(".zip")) {
    return "zip";
  }
  if (lower.endsWith(".7z")) {
    return "7z";
  }
  if (lower.endsWith(".gz")) {
    return "gz";
  }

  throw new MikaCliError("EDITOR_INVALID_ARGUMENT", `Could not infer archive format from "${inputPath}".`, {
    details: {
      supportedFormats: ["zip", "tar", "tar.gz", "tgz", "gz", "7z"],
    },
  });
}

function toArchiveCreateArg(inputPath: string, resolvedPath: string): string {
  if (!inputPath.startsWith("/")) {
    return inputPath;
  }

  const cwdRelative = resolvedPath.startsWith(process.cwd()) ? resolvedPath.slice(process.cwd().length + 1) : null;
  return cwdRelative && cwdRelative.length > 0 ? cwdRelative : resolvedPath;
}

function normalizeArchiveFormat(value: string): ArchiveFormat {
  const normalized = normalizeOutputExtension(value);
  if (normalized === "zip" || normalized === "tar" || normalized === "7z" || normalized === "gz") {
    return normalized;
  }
  if (normalized === "tar.gz" || normalized === "tgz") {
    return normalized;
  }

  throw new MikaCliError("EDITOR_INVALID_ARGUMENT", `Unsupported archive format "${value}".`, {
    details: {
      supportedFormats: ["zip", "tar", "tar.gz", "tgz", "gz", "7z"],
    },
  });
}

async function runZip(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return runEditorBinary({
    command: ZIP_BIN,
    args,
    missingCode: "ARCHIVE_ZIP_NOT_AVAILABLE",
    missingMessage: "zip is not installed or not available in PATH.",
    failureCode: "ARCHIVE_CREATE_FAILED",
    failureMessage: "Failed to create the zip archive.",
  });
}

async function runUnzip(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return runEditorBinary({
    command: UNZIP_BIN,
    args,
    missingCode: "ARCHIVE_UNZIP_NOT_AVAILABLE",
    missingMessage: "unzip is not installed or not available in PATH.",
    failureCode: "ARCHIVE_EXTRACT_FAILED",
    failureMessage: "Failed to extract or list the zip archive.",
  });
}

async function runTar(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return runEditorBinary({
    command: TAR_BIN,
    args,
    missingCode: "ARCHIVE_TAR_NOT_AVAILABLE",
    missingMessage: "tar is not installed or not available in PATH.",
    failureCode: "ARCHIVE_TAR_FAILED",
    failureMessage: "Failed to process the tar archive.",
  });
}

async function runSevenZip(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return runEditorBinary({
    command: SEVEN_Z_BIN,
    args,
    missingCode: "ARCHIVE_7Z_NOT_AVAILABLE",
    missingMessage: "7z is not installed or not available in PATH.",
    failureCode: "ARCHIVE_7Z_FAILED",
    failureMessage: "Failed to process the 7z archive.",
  });
}

async function pipeBinaryToFile(input: {
  command: string;
  args: readonly string[];
  outputPath: string;
  missingCode: string;
  missingMessage: string;
  failureCode: string;
  failureMessage: string;
}): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(input.command, input.args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const outputStream = createWriteStream(input.outputPath);
    let stderr = "";

    child.stdout.pipe(outputStream);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      outputStream.destroy();
      rejectPromise(
        new MikaCliError(input.missingCode, input.missingMessage, {
          details: {
            command: input.command,
          },
          cause: error,
        }),
      );
    });

    child.on("close", (code) => {
      outputStream.end();
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new MikaCliError(input.failureCode, input.failureMessage, {
          details: {
            command: input.command,
            args: input.args,
            stderr: stderr.trim() || null,
          },
        }),
      );
    });
  });
}
