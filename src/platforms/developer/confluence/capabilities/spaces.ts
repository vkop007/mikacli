import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { confluenceAdapter, type ConfluenceAdapter } from "../adapter.js";
import { printConfluenceListResult } from "../output.js";

export function createConfluenceSpacesCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "spaces",
    command: "spaces [query]",
    description: `List ${adapter.displayName} spaces available to the saved account`,
    spinnerText: `Loading ${adapter.displayName} spaces...`,
    successMessage: `${adapter.displayName} spaces loaded.`,
    options: [{ flags: "--limit <number>", description: "Maximum spaces to load (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.spaces({
        query: args[0] ? String(args[0]) : undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printConfluenceListResult,
  });
}

export const confluenceSpacesCapability = createConfluenceSpacesCapability(confluenceAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}
