import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printMovieStatusResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data ?? {};
  if (typeof data.status === "string") {
    console.log(`status: ${data.status}`);
  }
  if (typeof data.details === "string" && data.details.length > 0) {
    console.log(`details: ${data.details}`);
  }
}

export function printMovieSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? (result.data?.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log("No results found.");
    return;
  }

  const rows = items.map((item) => ({
    id: String(item.id ?? "-"),
    title: String(item.title ?? "-"),
    year: item.year === undefined ? "-" : String(item.year),
    type: String(item.type ?? "-"),
  }));
  const widths = {
    id: Math.max("id".length, ...rows.map((row) => row.id.length)),
    title: Math.max("title".length, ...rows.map((row) => row.title.length)),
    year: Math.max("year".length, ...rows.map((row) => row.year.length)),
    type: Math.max("type".length, ...rows.map((row) => row.type.length)),
  };

  console.log(
    [
      "id".padEnd(widths.id),
      "title".padEnd(widths.title),
      "year".padEnd(widths.year),
      "type".padEnd(widths.type),
    ].join("  "),
  );
  console.log(
    [
      "-".repeat(widths.id),
      "-".repeat(widths.title),
      "-".repeat(widths.year),
      "-".repeat(widths.type),
    ].join("  "),
  );
  for (const row of rows) {
    console.log([row.id.padEnd(widths.id), row.title.padEnd(widths.title), row.year.padEnd(widths.year), row.type.padEnd(widths.type)].join("  "));
  }
}

export function printMovieTitleResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const title = (result.data?.title ?? {}) as Record<string, unknown>;
  for (const key of [
    "title",
    "year",
    "type",
    "status",
    "score",
    "rating",
    "ranked",
    "popularity",
    "members",
    "episodes",
    "runtime",
    "studio",
    "network",
    "language",
    "country",
    "offerCount",
    "offers",
    "genres",
    "cast",
    "summary",
  ]) {
    const value = title[key];
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      console.log(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    }
  }
}

export function printMovieAvailabilityResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = (result.data ?? {}) as Record<string, unknown>;
  if (typeof data.title === "string") {
    console.log(`title: ${data.title}`);
  }
  if (typeof data.country === "string") {
    console.log(`country: ${data.country}`);
  }
  if (typeof data.type === "string") {
    console.log(`type: ${data.type}`);
  }

  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log("No offers found.");
    return;
  }

  console.log("offers:");
  for (const item of items) {
    const provider = String(item.provider ?? "-");
    const kind = item.kind === undefined ? "-" : String(item.kind);
    const price = item.price === undefined ? "-" : String(item.price);
    const currency = item.currency === undefined ? "" : ` ${String(item.currency)}`;
    console.log(`  ${provider}: ${kind} ${price}${currency}`.trim());
  }
}

export function printMovieListResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? (result.data?.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log("No list entries found.");
    return;
  }

  const rows = items.map((item) => ({
    title: String(item.title ?? "-"),
    progress: item.progress === undefined ? "-" : String(item.progress),
    score: item.score === undefined ? "-" : String(item.score),
    status: String(item.status ?? "-"),
  }));
  const widths = {
    title: Math.max("title".length, ...rows.map((row) => row.title.length)),
    progress: Math.max("progress".length, ...rows.map((row) => row.progress.length)),
    score: Math.max("score".length, ...rows.map((row) => row.score.length)),
    status: Math.max("status".length, ...rows.map((row) => row.status.length)),
  };

  console.log(
    [
      "title".padEnd(widths.title),
      "progress".padEnd(widths.progress),
      "score".padEnd(widths.score),
      "status".padEnd(widths.status),
    ].join("  "),
  );
  console.log(
    [
      "-".repeat(widths.title),
      "-".repeat(widths.progress),
      "-".repeat(widths.score),
      "-".repeat(widths.status),
    ].join("  "),
  );
  for (const row of rows) {
    console.log(
      [row.title.padEnd(widths.title), row.progress.padEnd(widths.progress), row.score.padEnd(widths.score), row.status.padEnd(widths.status)].join(
        "  ",
      ),
    );
  }
}

export function printMovieProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const profile = (result.data?.profile ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(profile)) {
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      console.log(`${key}: ${value}`);
    }
  }
}

export function printMovieRecommendationsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const items = Array.isArray(result.data?.items) ? (result.data?.items as Array<Record<string, unknown>>) : [];
  if (items.length === 0) {
    console.log("No recommendations found.");
    return;
  }

  for (const item of items) {
    const title = String(item.title ?? "-");
    const id = String(item.id ?? "-");
    const summary = String(item.summary ?? "");
    console.log(`${title} (${id})`);
    if (summary) {
      console.log(summary);
    }
    console.log("");
  }
}
