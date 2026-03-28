import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printSoundCloudSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      type?: string;
      title?: string;
      subtitle?: string;
      detail?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${item.type ? `[${item.type}] ` : ""}${item.title ?? "Untitled item"}`);

    const meta = [item.subtitle, item.detail].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }

    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

export function printSoundCloudTrackResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const primary = [data.artist, data.duration, data.genre].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (primary.length > 0) {
    console.log(primary.join(" • "));
  }

  const stats = [data.plays, data.likes, data.comments, data.reposts].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (stats.length > 0) {
    console.log(stats.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    console.log(data.description);
  }
}

export function printSoundCloudPlaylistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.owner, data.totalTracks, data.duration].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    console.log(data.description);
  }

  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      title?: string;
      subtitle?: string;
      detail?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${track.title ?? "Untitled track"}`);
    const details = [track.subtitle, track.detail].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (details.length > 0) {
      console.log(`   ${details.join(" • ")}`);
    }
    if (track.url) {
      console.log(`   ${track.url}`);
    }
  }
}

export function printSoundCloudUserResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.fullName, data.location, data.followers, data.trackCount, data.playlistCount].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    console.log(data.description);
  }

  const tracks = Array.isArray(data.topTracks) ? data.topTracks : [];
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      title?: string;
      subtitle?: string;
      detail?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${track.title ?? "Untitled track"}`);
    const details = [track.subtitle, track.detail].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (details.length > 0) {
      console.log(`   ${details.join(" • ")}`);
    }
    if (track.url) {
      console.log(`   ${track.url}`);
    }
  }
}

export function printSoundCloudDownloadResult(result: AdapterActionResult, json: boolean): void {
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
    console.log(`saved: ${data.outputPath}`);
  }
  if (typeof data.protocol === "string" && data.protocol.length > 0) {
    console.log(`protocol: ${data.protocol}`);
  }
  if (typeof data.mimeType === "string" && data.mimeType.length > 0) {
    console.log(`mime: ${data.mimeType}`);
  }
}
