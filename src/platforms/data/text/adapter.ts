import { AutoCliError } from "../../../errors.js";
import { loadTextSource, writeTextOutput } from "../shared/io.js";
import { collectTextStats, dedupeLines } from "../shared/text.js";

import type { AdapterActionResult } from "../../../types.js";

export class TextDataAdapter {
  readonly platform = "text" as const;
  readonly displayName = "Text";

  async stats(input: { source: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const stats = collectTextStats(loaded.content);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "stats",
      message: `Calculated text stats for ${loaded.label}.`,
      data: {
        source: loaded.label,
        ...stats,
      },
    };
  }

  async replace(input: {
    source: string;
    find: string;
    replace: string;
    regex?: boolean;
    flags?: string;
    output?: string;
  }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const content = replaceInText(loaded.content, input.find, input.replace, Boolean(input.regex), input.flags);
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "replace",
      message: `Replaced text in ${loaded.label}.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }

  async dedupe(input: { source: string; ignoreCase?: boolean; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const originalLines = loaded.content.split(/\r?\n/);
    const content = dedupeLines(loaded.content, Boolean(input.ignoreCase));
    const dedupedLines = content.split(/\r?\n/);
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "dedupe-lines",
      message: `Removed ${Math.max(0, originalLines.length - dedupedLines.length)} duplicate line${originalLines.length - dedupedLines.length === 1 ? "" : "s"}.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
        originalLines: originalLines.length,
        dedupedLines: dedupedLines.length,
      },
    };
  }
}

export const textDataAdapter = new TextDataAdapter();

function replaceInText(content: string, find: string, replacement: string, regex: boolean, flags: string | undefined): string {
  if (!find) {
    throw new AutoCliError("DATA_TEXT_FIND_REQUIRED", "Provide --find with the text or regex to replace.");
  }

  if (regex) {
    const normalizedFlags = normalizeRegexFlags(flags);
    try {
      return content.replace(new RegExp(find, normalizedFlags), replacement);
    } catch (error) {
      throw new AutoCliError("DATA_TEXT_REGEX_INVALID", "The provided regular expression is invalid.", {
        cause: error,
        details: {
          find,
          flags: normalizedFlags,
        },
      });
    }
  }

  return content.split(find).join(replacement);
}

function normalizeRegexFlags(value: string | undefined): string {
  const normalized = value?.trim() || "g";
  return normalized.includes("g") ? normalized : `${normalized}g`;
}
