import { MikaCliError } from "../../../errors.js";

const BOARD_PATH_REGEX = /\/b\/([^/]+)/iu;
const CARD_PATH_REGEX = /\/c\/([^/]+)/iu;

export function normalizeTrelloBoardTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new MikaCliError("TRELLO_BOARD_TARGET_INVALID", "Trello board target cannot be empty.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const match = url.pathname.match(BOARD_PATH_REGEX)?.[1];
    if (!match) {
      throw new MikaCliError("TRELLO_BOARD_TARGET_INVALID", `Could not resolve a Trello board from "${target}".`);
    }
    return decodeURIComponent(match);
  }

  return trimmed;
}

export function normalizeTrelloCardTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new MikaCliError("TRELLO_CARD_TARGET_INVALID", "Trello card target cannot be empty.");
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    const url = new URL(trimmed);
    const match = url.pathname.match(CARD_PATH_REGEX)?.[1];
    if (!match) {
      throw new MikaCliError("TRELLO_CARD_TARGET_INVALID", `Could not resolve a Trello card from "${target}".`);
    }
    return decodeURIComponent(match);
  }

  return trimmed;
}

export function matchesTrelloQuery(input: { name?: string | null; description?: string | null }, query?: string): boolean {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [input.name, input.description].some((value) => typeof value === "string" && value.toLowerCase().includes(normalizedQuery));
}
