import YAML from "yaml";

import { AutoCliError } from "../../../errors.js";
import { loadTextSource, writeTextOutput } from "../shared/io.js";

import type { AdapterActionResult } from "../../../types.js";

export class YamlDataAdapter {
  readonly platform = "yaml" as const;
  readonly displayName = "YAML";

  async format(input: { source: string; indent?: number; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const parsed = parseYamlValue(loaded.content);
    const content = YAML.stringify(parsed, null, {
      indent: normalizeIndent(input.indent, 2),
    });
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "format",
      message: `Formatted YAML from ${loaded.label}.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }

  async toJson(input: { source: string; indent?: number; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const parsed = parseYamlValue(loaded.content);
    const content = JSON.stringify(parsed, null, normalizeIndent(input.indent, 2));
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "to-json",
      message: `Converted YAML from ${loaded.label} to JSON.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }
}

export const yamlDataAdapter = new YamlDataAdapter();

function parseYamlValue(raw: string): unknown {
  try {
    return YAML.parse(raw);
  } catch (error) {
    throw new AutoCliError("DATA_YAML_INVALID", "Input is not valid YAML.", {
      cause: error,
    });
  }
}

function normalizeIndent(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(8, Math.floor(value)));
}
