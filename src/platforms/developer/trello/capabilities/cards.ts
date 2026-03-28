import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { trelloAdapter, type TrelloAdapter } from "../adapter.js";
import { printTrelloCardResult, printTrelloCardsResult } from "../output.js";

export function createTrelloCardsCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "cards",
    command: "cards <board>",
    description: `List open ${adapter.displayName} cards on a board`,
    spinnerText: `Loading ${adapter.displayName} cards...`,
    successMessage: `${adapter.displayName} cards loaded.`,
    options: [
      { flags: "--list <target>", description: "Filter cards to a specific list by ID or exact name" },
      { flags: "--limit <number>", description: "Maximum cards to load (default: 20)", parser: parsePositiveInteger },
    ],
    action: ({ args, options }) =>
      adapter.cards({
        board: String(args[0] ?? ""),
        list: options.list as string | undefined,
        limit: options.limit as number | undefined,
      }),
    onSuccess: printTrelloCardsResult,
  });
}

export function createTrelloCardCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "card",
    command: "card <target>",
    description: `Load a single ${adapter.displayName} card by ID, short link, or URL`,
    spinnerText: `Loading ${adapter.displayName} card...`,
    successMessage: `${adapter.displayName} card loaded.`,
    action: ({ args }) => adapter.card(String(args[0] ?? "")),
    onSuccess: printTrelloCardResult,
  });
}

export function createTrelloCreateCardCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "create-card",
    command: "create-card <board>",
    description: `Create a ${adapter.displayName} card on a board you can edit`,
    spinnerText: `Creating ${adapter.displayName} card...`,
    successMessage: `${adapter.displayName} card created.`,
    options: [
      { flags: "--list <target>", description: "Destination list ID or exact name (defaults to the first open list)" },
      { flags: "--name <text>", description: "Card title", required: true },
      { flags: "--description <text>", description: "Card description" },
    ],
    action: ({ args, options }) =>
      adapter.createCard({
        board: String(args[0] ?? ""),
        list: options.list as string | undefined,
        name: String(options.name ?? ""),
        description: options.description as string | undefined,
      }),
    onSuccess: printTrelloCardResult,
  });
}

export const trelloCardsCapability = createTrelloCardsCapability(trelloAdapter);
export const trelloCardCapability = createTrelloCardCapability(trelloAdapter);
export const trelloCreateCardCapability = createTrelloCreateCardCapability(trelloAdapter);

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number "${value}". Expected a positive integer.`);
  }
  return parsed;
}
