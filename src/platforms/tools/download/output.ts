import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

type DownloadFormatSummary = {
  id: string;
  label: string;
};

type DownloadPlaylistItemSummary = {
  id?: string;
  url?: string;
  title: string;
  durationLabel?: string;
  uploader?: string;
};

type DownloadBatchItem = {
  target: string;
  ok: boolean;
  message?: string;
  code?: string;
  id?: string;
  url?: string;
  outputPath?: string;
};

export function printDownloadResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};

  if (typeof data.title === "string" && data.title) {
    console.log(`title: ${data.title}`);
  }

  if (typeof data.uploader === "string" && data.uploader) {
    console.log(`uploader: ${data.uploader}`);
  }

  if (typeof data.extractor === "string" && data.extractor) {
    console.log(`extractor: ${data.extractor}`);
  }

  if (typeof data.durationLabel === "string" && data.durationLabel) {
    console.log(`duration: ${data.durationLabel}`);
  }

  if (typeof data.playlistCount === "number") {
    console.log(`items: ${data.playlistCount}`);
  }

  if (typeof data.outputPath === "string" && data.outputPath) {
    console.log(`file: ${data.outputPath}`);
  }

  if (Array.isArray(data.outputPaths) && data.outputPaths.length > 1) {
    for (const outputPath of data.outputPaths as string[]) {
      console.log(`file: ${outputPath}`);
    }
  }

  if (typeof data.audioFormat === "string" && data.audioFormat) {
    console.log(`audio-format: ${data.audioFormat}`);
  }

  if (typeof data.format === "string" && data.format) {
    console.log(`format: ${data.format}`);
  }

  if (typeof data.quality === "string" && data.quality) {
    console.log(`quality: ${data.quality}`);
  }

  if (data.auth && typeof data.auth === "object" && !Array.isArray(data.auth)) {
    const source = (data.auth as { source?: unknown }).source;
    if (typeof source === "string" && source) {
      console.log(`auth-source: ${source}`);
    }
  }

  if (Array.isArray(data.formats) && data.formats.length > 0) {
    console.log("formats:");
    for (const format of data.formats.slice(0, 10) as DownloadFormatSummary[]) {
      console.log(`- ${format.label} (${format.id})`);
    }
    if (data.formats.length > 10) {
      console.log(`- ... ${data.formats.length - 10} more`);
    }
  }

  if (Array.isArray(data.items) && data.items.length > 0) {
    console.log("items:");
    for (const item of data.items.slice(0, 10) as DownloadPlaylistItemSummary[]) {
      const meta = [item.uploader, item.durationLabel].filter((value): value is string => Boolean(value));
      const label = item.id ? `${item.title} (${item.id})` : item.title;
      console.log(`- ${label}`);
      if (meta.length > 0) {
        console.log(`  ${meta.join(" • ")}`);
      }
      if (item.url) {
        console.log(`  ${item.url}`);
      }
    }
    if (data.items.length > 10) {
      console.log(`- ... ${data.items.length - 10} more`);
    }
  }
}

export function printDownloadBatchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  if (typeof data.inputPath === "string" && data.inputPath) {
    console.log(`input: ${data.inputPath}`);
  }

  const results = Array.isArray(data.results) ? (data.results as DownloadBatchItem[]) : [];
  for (const item of results) {
    if (item.ok) {
      console.log(`ok   ${item.target}`);
      if (item.outputPath) {
        console.log(`     file: ${item.outputPath}`);
      } else if (item.url) {
        console.log(`     ${item.url}`);
      }
    } else {
      console.log(`fail ${item.target}`);
      console.log(`     ${item.code ?? "ERROR"}: ${item.message ?? "Unknown error"}`);
    }
  }
}
