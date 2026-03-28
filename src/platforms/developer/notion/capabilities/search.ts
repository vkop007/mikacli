import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionListResult } from "../output.js";

export function createNotionSearchCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "search",
    command: "search [query]",
    description: "Search Notion pages and data sources the integration can access",
    spinnerText: "Searching Notion...",
    successMessage: "Notion search completed.",
    options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.search({
        query: args[0] ? String(args[0]) : undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printNotionListResult,
  });
}

export function createNotionPagesCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "pages",
    command: "pages [query]",
    description: "List Notion pages the integration can access",
    spinnerText: "Loading Notion pages...",
    successMessage: "Notion pages loaded.",
    options: [{ flags: "--limit <number>", description: "Maximum pages to return (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.pages({
        query: args[0] ? String(args[0]) : undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printNotionListResult,
  });
}

export function createNotionDataSourcesCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "databases",
    command: "databases [query]",
    aliases: ["data-sources"],
    description: "List Notion data sources the integration can access",
    spinnerText: "Loading Notion data sources...",
    successMessage: "Notion data sources loaded.",
    options: [{ flags: "--limit <number>", description: "Maximum data sources to return (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.dataSources({
        query: args[0] ? String(args[0]) : undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printNotionListResult,
  });
}

export const notionSearchCapability = createNotionSearchCapability(notionAdapter);
export const notionPagesCapability = createNotionPagesCapability(notionAdapter);
export const notionDataSourcesCapability = createNotionDataSourcesCapability(notionAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}

