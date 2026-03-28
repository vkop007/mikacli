import { marked } from "marked";

import { loadTextSource, writeTextOutput } from "../shared/io.js";
import { htmlToText } from "../shared/text.js";

import type { AdapterActionResult } from "../../../types.js";

export class MarkdownDataAdapter {
  readonly platform = "markdown" as const;
  readonly displayName = "Markdown";

  async toHtml(input: { source: string; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const content = String(marked.parse(loaded.content));
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "to-html",
      message: `Converted Markdown from ${loaded.label} to HTML.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }

  async text(input: { source: string; output?: string }): Promise<AdapterActionResult> {
    const loaded = await loadTextSource(input.source);
    const html = String(marked.parse(loaded.content));
    const content = htmlToText(html);
    const outputPath = await writeTextOutput(content, input.output);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "text",
      message: `Converted Markdown from ${loaded.label} to plain text.`,
      data: {
        source: loaded.label,
        outputPath,
        content,
      },
    };
  }
}

export const markdownDataAdapter = new MarkdownDataAdapter();
