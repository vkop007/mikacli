import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printYouTubeMusicSearchResult(result: AdapterActionResult, json: boolean): void {
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

export function printYouTubeMusicInfoResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [data.artists, data.album, data.duration].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 300 ? `${data.description.slice(0, 300)}...` : data.description;
    console.log(preview);
  }
}

export function printYouTubeMusicBrowseResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const heading = typeof data.title === "string" ? data.title : undefined;
  const meta = [data.subtitle, typeof data.itemCount === "number" ? `${data.itemCount} item${data.itemCount === 1 ? "" : "s"}` : undefined].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  if (heading) {
    console.log(heading);
  }
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }
  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 300 ? `${data.description.slice(0, 300)}...` : data.description;
    console.log(preview);
  }

  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length > 0) {
    printResultList(results);
    return;
  }

  const sections = Array.isArray(data.sections) ? data.sections : [];
  for (const [sectionIndex, section] of sections.entries()) {
    if (!section || typeof section !== "object") {
      continue;
    }

    const title = typeof section.title === "string" && section.title.length > 0 ? section.title : `Section ${sectionIndex + 1}`;
    console.log("");
    console.log(title);

    const sectionResults = Array.isArray(section.results) ? section.results : [];
    printResultList(sectionResults);
  }
}

function printResultList(results: unknown[]): void {
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

export function printYouTubeMusicPlaybackStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.mode === "string" ? `mode: ${data.mode}` : undefined,
    typeof data.position === "string" ? `position: ${data.position}` : undefined,
    typeof data.queueLength === "number" ? `queue: ${data.queueLength}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const item = data.item;
  if (!item || typeof item !== "object") {
    return;
  }

  const currentItem = item as {
    subtitle?: string;
    detail?: string;
  };

  const details = [currentItem.subtitle, currentItem.detail].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (details.length > 0) {
    console.log(details.join(" • "));
  }
}

export function printYouTubeMusicQueueResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      position?: number;
      current?: boolean;
      title?: string;
      subtitle?: string;
      detail?: string;
      url?: string;
    };
    const marker = item.current ? ">" : " ";
    console.log(`${marker} ${item.position ?? "?"}. ${item.title ?? "Untitled item"}`);

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
