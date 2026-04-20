import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { MikaCliError } from "../../../errors.js";

export interface LoadedTextSource {
  kind: "file" | "literal" | "stdin";
  label: string;
  path?: string;
  content: string;
}

export async function loadTextSource(source: string): Promise<LoadedTextSource> {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new MikaCliError("DATA_INPUT_REQUIRED", "Provide a data input string, file path, or '-' for stdin.");
  }

  if (trimmed === "-") {
    if (process.stdin.isTTY) {
      throw new MikaCliError("DATA_STDIN_EMPTY", "Expected piped stdin input, but stdin is interactive.");
    }

    return {
      kind: "stdin",
      label: "stdin",
      content: await readStdin(),
    };
  }

  const resolvedPath = resolve(trimmed);
  if (await pathExists(resolvedPath)) {
    return {
      kind: "file",
      label: resolvedPath,
      path: resolvedPath,
      content: await readFile(resolvedPath, "utf8"),
    };
  }

  return {
    kind: "literal",
    label: "literal",
    content: source,
  };
}

export async function loadTextSources(sources: string[]): Promise<LoadedTextSource[]> {
  return Promise.all(sources.map((source) => loadTextSource(source)));
}

export async function writeTextOutput(content: string, outputPath: string | undefined): Promise<string | undefined> {
  if (!outputPath) {
    return undefined;
  }

  const resolvedPath = resolve(outputPath);
  await writeFile(resolvedPath, content, "utf8");
  return resolvedPath;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}
