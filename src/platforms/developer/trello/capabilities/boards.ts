import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { trelloAdapter, type TrelloAdapter } from "../adapter.js";
import { printTrelloBoardResult, printTrelloBoardsResult, printTrelloListsResult } from "../output.js";

export function createTrelloBoardsCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "boards",
    command: "boards [query]",
    description: `List ${adapter.displayName} boards for the authenticated account`,
    spinnerText: `Loading ${adapter.displayName} boards...`,
    successMessage: `${adapter.displayName} boards loaded.`,
    options: [{ flags: "--limit <number>", description: "Maximum boards to load (default: 20)", parser: parsePositiveInteger }],
    action: ({ args, options }) =>
      adapter.boards({
        query: args[0] ? String(args[0]) : undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printTrelloBoardsResult,
  });
}

export function createTrelloBoardCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "board",
    command: "board <target>",
    description: `Load a single ${adapter.displayName} board by ID, short link, or URL`,
    spinnerText: `Loading ${adapter.displayName} board...`,
    successMessage: `${adapter.displayName} board loaded.`,
    action: ({ args }) => adapter.board(String(args[0] ?? "")),
    onSuccess: printTrelloBoardResult,
  });
}

export function createTrelloListsCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "lists",
    command: "lists <board>",
    description: `List open ${adapter.displayName} lists for a board`,
    spinnerText: `Loading ${adapter.displayName} lists...`,
    successMessage: `${adapter.displayName} lists loaded.`,
    action: ({ args }) => adapter.lists(String(args[0] ?? "")),
    onSuccess: printTrelloListsResult,
  });
}

export const trelloBoardsCapability = createTrelloBoardsCapability(trelloAdapter);
export const trelloBoardCapability = createTrelloBoardCapability(trelloAdapter);
export const trelloListsCapability = createTrelloListsCapability(trelloAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}
