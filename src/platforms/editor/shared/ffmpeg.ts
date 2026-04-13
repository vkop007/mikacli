import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join, parse, resolve } from "node:path";

import { ensureParentDirectory } from "../../../config.js";
import { AutoCliError } from "../../../errors.js";

export interface FfprobeStream {
  index?: number;
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  duration?: string;
  sample_rate?: string;
  channels?: number;
  bit_rate?: string;
}

export interface FfprobeFormat {
  filename?: string;
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

export interface FfprobePayload {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

const FFMPEG_BIN = process.env.AUTOCLI_FFMPEG_BIN || "ffmpeg";
const FFPROBE_BIN = process.env.AUTOCLI_FFPROBE_BIN || "ffprobe";

export async function assertLocalInputFile(inputPath: string): Promise<string> {
  const resolved = resolve(inputPath);

  try {
    await access(resolved, constants.R_OK);
  } catch (error) {
    throw new AutoCliError("EDITOR_INPUT_NOT_FOUND", `Input file does not exist: ${inputPath}`, {
      details: {
        inputPath,
        resolvedPath: resolved,
      },
      cause: error,
    });
  }

  return resolved;
}

export async function runFfprobe(inputPath: string): Promise<FfprobePayload> {
  const resolvedPath = await assertLocalInputFile(inputPath);
  const { stdout } = await runBinary(
    FFPROBE_BIN,
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      resolvedPath,
    ],
    "FFPROBE_NOT_AVAILABLE",
    "ffprobe is not installed or not available in PATH.",
  );

  try {
    return JSON.parse(stdout) as FfprobePayload;
  } catch (error) {
    throw new AutoCliError("FFPROBE_OUTPUT_INVALID", "ffprobe returned invalid JSON output.", {
      details: {
        inputPath: resolvedPath,
      },
      cause: error,
    });
  }
}

export async function runFfmpegEdit(input: {
  args: readonly string[];
  inputPath: string;
  outputPath: string;
}): Promise<string> {
  const resolvedInput = await assertLocalInputFile(input.inputPath);
  const resolvedOutput = resolve(input.outputPath);
  await ensureParentDirectory(resolvedOutput);

  await runBinary(
    FFMPEG_BIN,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      ...input.args.map((value) => (value === "{input}" ? resolvedInput : value === "{output}" ? resolvedOutput : value)),
    ],
    "FFMPEG_NOT_AVAILABLE",
    "ffmpeg is not installed or not available in PATH.",
  );

  return resolvedOutput;
}

export function resolveEditorOutputPath(input: {
  inputPath: string;
  output?: string;
  suffix: string;
  extension?: string;
}): string {
  if (input.output) {
    return resolve(input.output);
  }

  const parsed = parse(resolve(input.inputPath));
  const extension = input.extension
    ? input.extension.startsWith(".")
      ? input.extension
      : `.${input.extension}`
    : parsed.ext || "";

  return join(parsed.dir, `${parsed.name}.${input.suffix}${extension}`);
}

export function toNumber(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function requirePositiveInteger(value: string | number | undefined, label: string): number {
  const parsed = toNumber(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} must be a positive integer.`, {
      details: {
        label,
        value,
      },
    });
  }

  return parsed;
}

export function requireNonNegativeInteger(value: string | number | undefined, label: string): number {
  const parsed = toNumber(value);
  if (parsed === undefined || !Number.isInteger(parsed) || parsed < 0) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} must be a non-negative integer.`, {
      details: {
        label,
        value,
      },
    });
  }

  return parsed;
}

export function parseRate(value: string | undefined): number | null {
  if (!value || value === "0/0") {
    return null;
  }

  const [numeratorRaw, denominatorRaw] = value.split("/");
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw ?? "1");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeOutputExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
}

async function runBinary(
  command: string,
  args: readonly string[],
  missingCode: string,
  missingMessage: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
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
        new AutoCliError(missingCode, missingMessage, {
          details: {
            command,
          },
          cause: error,
        }),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new AutoCliError("EDITOR_COMMAND_FAILED", `${command} exited with code ${code}.`, {
          details: {
            command,
            args,
            stderr: stderr.trim() || null,
            stdout: stdout.trim() || null,
          },
        }),
      );
    });
  });
}
