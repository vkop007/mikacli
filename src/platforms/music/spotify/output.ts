import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printSpotifyProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.product, data.country, data.email].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.profileUrl === "string" && data.profileUrl.length > 0) {
    console.log(`profile: ${data.profileUrl}`);
  }
}

export function printSpotifySearchResult(result: AdapterActionResult, json: boolean): void {
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

    const heading = item.type ? `${index + 1}. [${item.type}] ${item.title ?? "Untitled"}` : `${index + 1}. ${item.title ?? "Untitled"}`;
    console.log(heading);

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

export function printSpotifyTrackResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.artists, data.album, data.releaseDate, data.duration].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.albumUrl === "string" && data.albumUrl.length > 0) {
    console.log(`album: ${data.albumUrl}`);
  }
}

export function printSpotifyAlbumResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.artists, data.releaseDate, data.totalTracks, data.label].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      title?: string;
      duration?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${track.title ?? "Untitled track"}`);
    if (track.duration) {
      console.log(`   ${track.duration}`);
    }
    if (track.url) {
      console.log(`   ${track.url}`);
    }
  }
}

export function printSpotifyArtistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.followers, data.monthlyListeners].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.biography === "string" && data.biography.length > 0) {
    const preview = data.biography.length > 320 ? `${data.biography.slice(0, 320)}...` : data.biography;
    console.log(preview);
  }

  const tracks = Array.isArray(data.topTracks) ? data.topTracks : [];
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      title?: string;
      album?: string;
      duration?: string;
      url?: string;
    };
    const details = [track.album, track.duration].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    console.log(`${index + 1}. ${track.title ?? "Untitled track"}`);
    if (details.length > 0) {
      console.log(`   ${details.join(" • ")}`);
    }
    if (track.url) {
      console.log(`   ${track.url}`);
    }
  }
}

export function printSpotifyPlaylistResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.owner, data.followers, data.totalTracks].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 320 ? `${data.description.slice(0, 320)}...` : data.description;
    console.log(preview);
  }

  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  for (const [index, rawTrack] of tracks.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      title?: string;
      artists?: string;
      album?: string;
      duration?: string;
      url?: string;
    };

    const details = [track.artists, track.album, track.duration].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    console.log(`${index + 1}. ${track.title ?? "Untitled track"}`);
    if (details.length > 0) {
      console.log(`   ${details.join(" • ")}`);
    }
    if (track.url) {
      console.log(`   ${track.url}`);
    }
  }
}

export function printSpotifyDevicesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const devices = Array.isArray(result.data?.devices) ? result.data.devices : [];
  for (const [index, rawDevice] of devices.entries()) {
    if (!rawDevice || typeof rawDevice !== "object") {
      continue;
    }

    const device = rawDevice as {
      id?: string;
      name?: string;
      type?: string;
      isActive?: boolean;
      isRestricted?: boolean;
      volumePercent?: number;
    };

    const meta = [
      device.type,
      device.isActive ? "active" : undefined,
      device.isRestricted ? "restricted" : undefined,
      typeof device.volumePercent === "number" ? `${device.volumePercent}%` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${device.name ?? "Unknown device"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (device.id) {
      console.log(`   ${device.id}`);
    }
  }
}

export function printSpotifyPlaybackStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.deviceName, data.deviceType, data.repeatState, data.shuffleState, data.progress].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.title === "string" && data.title.length > 0) {
    const trackMeta = [data.artists, data.album].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    console.log(data.title);
    if (trackMeta.length > 0) {
      console.log(trackMeta.join(" • "));
    }
  }
}

export function printSpotifyQueueResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const current = result.data && typeof result.data === "object" && result.data.current && typeof result.data.current === "object"
    ? (result.data.current as { title?: string; artists?: string; album?: string })
    : undefined;

  if (current?.title) {
    const currentMeta = [current.artists, current.album].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    console.log(`Now playing: ${current.title}`);
    if (currentMeta.length > 0) {
      console.log(`  ${currentMeta.join(" • ")}`);
    }
  }

  const queue = Array.isArray(result.data?.queue) ? result.data.queue : [];
  for (const [index, rawTrack] of queue.entries()) {
    if (!rawTrack || typeof rawTrack !== "object") {
      continue;
    }

    const track = rawTrack as {
      title?: string;
      artists?: string;
      album?: string;
    };
    const meta = [track.artists, track.album].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    console.log(`${index + 1}. ${track.title ?? "Untitled track"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}

export function printSpotifyItemsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      title?: string;
      artists?: string;
      album?: string;
      subtitle?: string;
      detail?: string;
      duration?: string;
      playedAt?: string;
      addedAt?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${item.title ?? "Untitled item"}`);

    const meta = [item.artists, item.album, item.subtitle, item.detail, item.duration, item.playedAt, item.addedAt].filter(
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

export function printSpotifyPlaylistsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      title?: string;
      owner?: string;
      totalTracks?: string;
      description?: string;
      collaborative?: boolean;
      public?: boolean;
      url?: string;
    };

    console.log(`${index + 1}. ${item.title ?? "Untitled playlist"}`);
    const meta = [
      item.owner,
      item.totalTracks,
      item.collaborative ? "collaborative" : undefined,
      typeof item.public === "boolean" ? (item.public ? "public" : "private") : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.description) {
      console.log(`   ${item.description}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}
