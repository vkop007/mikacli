import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { MikaCliError } from "../errors.js";

export async function readBatchTargets(inputFile: string): Promise<{ inputPath: string; targets: string[] }> {
  const inputPath = resolve(inputFile);

  let raw: string;
  try {
    raw = await readFile(inputPath, "utf8");
  } catch (error) {
    throw new MikaCliError("BATCH_INPUT_NOT_FOUND", `Could not read batch input file at ${inputPath}.`, {
      cause: error,
      details: {
        inputFile,
        inputPath,
      },
    });
  }

  const trimmed = raw.trim();
  let targets: string[];

  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new MikaCliError("INVALID_BATCH_INPUT", "Batch input JSON could not be parsed.", {
        cause: error,
        details: {
          inputPath,
        },
      });
    }

    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
      throw new MikaCliError("INVALID_BATCH_INPUT", "Batch input JSON must be an array of strings.", {
        details: {
          inputPath,
        },
      });
    }

    targets = parsed;
  } else {
    targets = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  }

  const dedupedTargets = [...new Set(targets.map((value) => value.trim()).filter(Boolean))];
  if (dedupedTargets.length === 0) {
    throw new MikaCliError("EMPTY_BATCH_INPUT", "Batch input file does not contain any targets.", {
      details: {
        inputPath,
      },
    });
  }

  return {
    inputPath,
    targets: dedupedTargets,
  };
}
