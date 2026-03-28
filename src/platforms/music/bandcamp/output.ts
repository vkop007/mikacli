import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printBandcampSearchResult(result: AdapterActionResult, json: boolean): void {
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
    const meta = [item.subtitle, item.detail].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

export function printBandcampAlbumResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.artist, data.releaseDate, data.price].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (Array.isArray(data.tags) && data.tags.length > 0) {
    console.log(`tags: ${(data.tags as string[]).join(", ")}`);
  }

  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  if (tracks.length > 0) {
    console.log("tracks:");
  }
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      title?: string;
      duration?: string;
      url?: string;
    };

    console.log(`  ${index + 1}. ${track.title ?? "Untitled track"}${track.duration ? ` (${track.duration})` : ""}`);
    if (track.url) {
      console.log(`     ${track.url}`);
    }
  }
}

export function printBandcampTrackResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.artist, data.album, data.duration, data.releaseDate, data.price].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (Array.isArray(data.tags) && data.tags.length > 0) {
    console.log(`tags: ${(data.tags as string[]).join(", ")}`);
  }
}

export function printBandcampArtistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.location, data.genre, data.website].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const releases = Array.isArray(data.releases) ? data.releases : [];
  if (releases.length > 0) {
    console.log("releases:");
  }
  for (const [index, rawRelease] of releases.entries()) {
    if (!rawRelease || typeof rawRelease !== "object") {
      continue;
    }

    const release = rawRelease as {
      title?: string;
      detail?: string;
      url?: string;
    };

    console.log(`  ${index + 1}. ${release.title ?? "Untitled release"}`);
    if (release.detail) {
      console.log(`     ${release.detail}`);
    }
    if (release.url) {
      console.log(`     ${release.url}`);
    }
  }
}
