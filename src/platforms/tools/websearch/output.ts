import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printWebSearchEnginesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const engines = Array.isArray(result.data?.engines) ? result.data.engines : [];
  const defaultEngine = typeof result.data?.defaultEngine === "string" ? result.data.defaultEngine : undefined;

  for (const [index, rawEngine] of engines.entries()) {
    if (!rawEngine || typeof rawEngine !== "object") {
      continue;
    }

    const engine = rawEngine as {
      id?: string;
      label?: string;
      description?: string;
    };

    const suffix = engine.id && defaultEngine === engine.id ? " (default)" : "";
    console.log(`${index + 1}. ${engine.label ?? engine.id ?? "unknown"}${suffix}`);
    if (typeof engine.id === "string") {
      console.log(`   id: ${engine.id}`);
    }
    if (typeof engine.description === "string" && engine.description.trim().length > 0) {
      console.log(`   ${engine.description.trim()}`);
    }
  }
}

export function printWebSearchResults(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const summaryRequested = Boolean(result.data?.summaryRequested);

  const engines = Array.isArray(result.data?.engines) ? result.data.engines : [];
  for (const rawEngine of engines) {
    if (!rawEngine || typeof rawEngine !== "object") {
      continue;
    }

    const engine = rawEngine as {
      engine?: string;
      label?: string;
      searchUrl?: string;
      count?: number;
    };

    if (typeof engine.label === "string") {
      console.log(`\n[${engine.label}]`);
    }
    if (typeof engine.searchUrl === "string") {
      console.log(engine.searchUrl);
    }
    if (typeof engine.count === "number") {
      console.log(`results: ${engine.count}`);
    }

    const results = Array.isArray(result.data?.results)
      ? result.data.results.filter((entry) => entry && typeof entry === "object" && (entry as { engine?: string }).engine === engine.engine)
      : [];

    for (const [index, rawResult] of results.entries()) {
      const item = rawResult as {
        title?: string;
        url?: string;
        snippet?: string;
        fetchedSummary?: string;
      };

      console.log(`${index + 1}. ${item.title ?? "Untitled result"}`);
      if (summaryRequested) {
        if (typeof item.fetchedSummary === "string" && item.fetchedSummary.trim().length > 0) {
          console.log(`   summary: ${item.fetchedSummary.trim()}`);
        } else if (typeof item.snippet === "string" && item.snippet.trim().length > 0) {
          console.log(`   ${item.snippet.trim()}`);
        }
      }
      if (typeof item.url === "string") {
        console.log(`   ${item.url}`);
      }
    }
  }

  const errors = Array.isArray(result.data?.errors) ? result.data.errors : [];
  for (const rawError of errors) {
    if (!rawError || typeof rawError !== "object") {
      continue;
    }

    const error = rawError as {
      engine?: string;
      message?: string;
    };

    if (typeof error.engine === "string" && typeof error.message === "string") {
      console.log(`\n[${error.engine}] failed: ${error.message}`);
    }
  }
}
