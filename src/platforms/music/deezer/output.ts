import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printDeezerSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const results = Array.isArray(result.data?.results) ? (result.data.results as Array<Record<string, unknown>>) : [];
  if (results.length === 0) {
    console.log("No results found.");
    return;
  }

  for (const [index, item] of results.entries()) {
    console.log(`${index + 1}. ${String(item.title ?? "Untitled")}`);
    const meta = [item.subtitle, item.detail, item.url]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}

export function printDeezerTrackResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const meta = [data.artist, data.album, data.duration, data.plays]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof data.previewUrl === "string") {
    console.log(`preview: ${data.previewUrl}`);
  }
  if (typeof data.releaseDate === "string") {
    console.log(`release: ${data.releaseDate}`);
  }
}

export function printDeezerAlbumResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const meta = [data.artist, data.label, data.releaseDate, data.fans, data.tracks, data.duration]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof data.description === "string" && data.description.length > 0) {
    console.log(data.description);
  }

  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  if (items.length > 0) {
    console.log("tracks:");
    for (const [index, item] of items.entries()) {
      console.log(`  ${index + 1}. ${String(item.title ?? "Untitled")}`);
      const details = [item.subtitle, item.detail, item.url]
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (details.length > 0) {
        console.log(`     ${details.join(" • ")}`);
      }
    }
  }
}

export function printDeezerArtistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const meta = [data.fans, data.albums, data.summary]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof data.pictureUrl === "string") {
    console.log(`picture: ${data.pictureUrl}`);
  }

  const topTracks = Array.isArray(data.topTracks) ? (data.topTracks as Array<Record<string, unknown>>) : [];
  if (topTracks.length > 0) {
    console.log("top tracks:");
    for (const [index, item] of topTracks.entries()) {
      console.log(`  ${index + 1}. ${String(item.title ?? "Untitled")}`);
      const details = [item.subtitle, item.detail, item.url]
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (details.length > 0) {
        console.log(`     ${details.join(" • ")}`);
      }
    }
  }

  const releases = Array.isArray(data.releases) ? (data.releases as Array<Record<string, unknown>>) : [];
  if (releases.length > 0) {
    console.log("releases:");
    for (const [index, item] of releases.entries()) {
      console.log(`  ${index + 1}. ${String(item.title ?? "Untitled")}`);
      const details = [item.detail, item.url]
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (details.length > 0) {
        console.log(`     ${details.join(" • ")}`);
      }
    }
  }
}

export function printDeezerPlaylistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const meta = [data.owner, data.tracks, data.duration, data.fans]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof data.description === "string" && data.description.length > 0) {
    console.log(data.description);
  }

  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  if (items.length > 0) {
    console.log("tracks:");
    for (const [index, item] of items.entries()) {
      console.log(`  ${index + 1}. ${String(item.title ?? "Untitled")}`);
      const details = [item.subtitle, item.detail, item.url]
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (details.length > 0) {
        console.log(`     ${details.join(" • ")}`);
      }
    }
  }
}
