import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionDataSourceResult, printNotionListResult } from "../output.js";

export function createNotionDataSourceCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "database",
    command: "database <target>",
    aliases: ["datasource"],
    description: "Load a single Notion data source by ID or URL",
    spinnerText: "Loading Notion data source...",
    successMessage: "Notion data source loaded.",
    action: ({ args }) => adapter.dataSource(String(args[0] ?? "")),
    onSuccess: printNotionDataSourceResult,
  });
}

export function createNotionQueryCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "query",
    command: "query <target>",
    description: "Query rows from a Notion data source",
    spinnerText: "Querying Notion data source...",
    successMessage: "Notion data source queried.",
    options: [{ flags: "--limit <number>", description: "Maximum rows to load (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.queryDataSource({
        target: String(args[0] ?? ""),
        limit: options.limit as number | undefined,
      }),
    onSuccess: printNotionListResult,
  });
}

export const notionDataSourceCapability = createNotionDataSourceCapability(notionAdapter);
export const notionQueryCapability = createNotionQueryCapability(notionAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}

