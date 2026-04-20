import { XMLBuilder, XMLParser } from "fast-xml-parser";

import { MikaCliError } from "../../../errors.js";
import { loadTextSource, writeTextOutput } from "../shared/io.js";

import type { AdapterActionResult } from "../../../types.js";

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

export class XmlDataAdapter {
  readonly platform = "xml" as const;
  readonly displayName = "XML";

  async format(input: { source: string; indent?: number; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const parsed = parseXmlValue(loaded.content);
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      format: true,
      indentBy: " ".repeat(normalizeIndent(input.indent, 2)),
      suppressEmptyNode: false,
    });
    const content = builder.build(parsed);
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "format",
      message: `Formatted XML from ${loaded.label}.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }

  async toJson(input: { source: string; indent?: number; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const parsed = parseXmlValue(loaded.content);
    const content = JSON.stringify(parsed, null, normalizeIndent(input.indent, 2));
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "to-json",
      message: `Converted XML from ${loaded.label} to JSON.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }
}

export const xmlDataAdapter = new XmlDataAdapter();

function parseXmlValue(raw: string): unknown {
  try {
    return XML_PARSER.parse(raw);
  } catch (error) {
    throw new MikaCliError("DATA_XML_INVALID", "Input is not valid XML.", {
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
