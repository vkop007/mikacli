import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printYouTubeSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  if (results.length === 0) {
    return;
  }

  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      title?: string;
      channel?: string;
      duration?: string;
      views?: string;
      published?: string;
      url?: string;
    };

    const meta = [item.channel, item.views, item.published, item.duration].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    console.log(`${index + 1}. ${item.title ?? "Untitled video"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

export function printYouTubeDownloadResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  if (typeof data.outputPath === "string" && data.outputPath.length > 0) {
    console.log(`file: ${data.outputPath}`);
  }

  const meta = [
    typeof data.audioOnly === "boolean" ? (data.audioOnly ? "audio-only" : "video+audio") : undefined,
    typeof data.audioFormat === "string" ? data.audioFormat : undefined,
    typeof data.format === "string" ? data.format : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
}

export function printYouTubeInfoResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.channel, data.views, data.published, data.duration, data.category].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.channelUrl === "string") {
    console.log(`channel: ${data.channelUrl}`);
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 300 ? `${data.description.slice(0, 300)}...` : data.description;
    console.log(preview);
  }
}

export function printYouTubeChannelResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.handle, data.subscriberCount].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.rssUrl === "string") {
    console.log(`rss: ${data.rssUrl}`);
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 300 ? `${data.description.slice(0, 300)}...` : data.description;
    console.log(preview);
  }
}

export function printYouTubePlaylistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.videoCount, data.viewCount, data.updated].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const items = Array.isArray(data.items) ? data.items : [];
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      title?: string;
      channel?: string;
      duration?: string;
      url?: string;
    };
    const itemMeta = [item.channel, item.duration].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    console.log(`${index + 1}. ${item.title ?? "Untitled video"}`);
    if (itemMeta.length > 0) {
      console.log(`   ${itemMeta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

export function printYouTubeCaptionsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const tracks = result.data && typeof result.data === "object" && Array.isArray(result.data.tracks) ? result.data.tracks : [];
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      language?: string;
      languageCode?: string;
      autoGenerated?: boolean;
      kind?: string;
      isTranslatable?: boolean;
    };
    const meta = [
      track.languageCode,
      track.autoGenerated ? "auto-generated" : undefined,
      track.kind,
      track.isTranslatable ? "translatable" : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${track.language ?? "Unknown language"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}
