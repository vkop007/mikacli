import TurndownService from "turndown";

import { loadTextSource, writeTextOutput } from "../shared/io.js";
import { htmlToText } from "../shared/text.js";

import type { AdapterActionResult } from "../../../types.js";

const TURNDOWN = new TurndownService({
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  headingStyle: "atx",
});

export class HtmlDataAdapter {
  readonly platform = "html" as const;
  readonly displayName = "HTML";

  async text(input: { source: string; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const content = htmlToText(loaded.content);
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "text",
      message: `Converted HTML from ${loaded.label} to plain text.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }

  async toMarkdown(input: { source: string; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const content = TURNDOWN.turndown(loaded.content).trim();
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "to-markdown",
      message: `Converted HTML from ${loaded.label} to Markdown.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }
}

export const htmlDataAdapter = new HtmlDataAdapter();
