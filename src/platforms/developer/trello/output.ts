import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printTrelloIdentityResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const user = result.data?.user as Record<string, unknown> | undefined;
  if (!user) {
    return;
  }

  const meta = [
    typeof user.displayName === "string" ? user.displayName : undefined,
    typeof user.username === "string" ? `@${user.username}` : undefined,
    typeof user.id === "string" ? user.id : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof user.profileUrl === "string") {
    console.log(user.profileUrl);
  }
}

export function printTrelloBoardsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const boards = Array.isArray(result.data?.boards) ? result.data.boards : [];
  for (const [index, rawBoard] of boards.entries()) {
    if (!rawBoard || typeof rawBoard !== "object") {
      continue;
    }

    const board = rawBoard as {
      name?: string;
      description?: string;
      shortLink?: string;
      updatedAt?: string;
      url?: string;
    };

    console.log(`${index + 1}. ${board.name ?? "Untitled board"}`);
    const meta = [
      typeof board.shortLink === "string" ? board.shortLink : undefined,
      typeof board.updatedAt === "string" ? board.updatedAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof board.description === "string" && board.description.trim().length > 0) {
      console.log(`   ${board.description.trim()}`);
    }
    if (typeof board.url === "string") {
      console.log(`   ${board.url}`);
    }
  }
}

export function printTrelloBoardResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const board = result.data?.board as Record<string, unknown> | undefined;
  if (!board) {
    return;
  }

  if (typeof board.name === "string") {
    console.log(board.name);
  }

  const meta = [
    typeof board.shortLink === "string" ? board.shortLink : undefined,
    typeof board.openLists === "number" ? `${board.openLists} open lists` : undefined,
    typeof board.updatedAt === "string" ? board.updatedAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof board.description === "string" && board.description.trim().length > 0) {
    console.log(board.description.trim());
  }
  if (typeof board.url === "string") {
    console.log(board.url);
  }
}

export function printTrelloListsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const lists = Array.isArray(result.data?.lists) ? result.data.lists : [];
  for (const [index, rawList] of lists.entries()) {
    if (!rawList || typeof rawList !== "object") {
      continue;
    }

    const list = rawList as {
      id?: string;
      name?: string;
      position?: number;
    };
    console.log(`${index + 1}. ${list.name ?? "Untitled list"}`);
    const meta = [
      typeof list.id === "string" ? list.id : undefined,
      typeof list.position === "number" ? `pos ${list.position}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
  }
}

export function printTrelloCardsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const cards = Array.isArray(result.data?.cards) ? result.data.cards : [];
  for (const [index, rawCard] of cards.entries()) {
    if (!rawCard || typeof rawCard !== "object") {
      continue;
    }

    const card = rawCard as {
      name?: string;
      due?: string | null;
      updatedAt?: string;
      url?: string;
    };
    console.log(`${index + 1}. ${card.name ?? "Untitled card"}`);
    const meta = [
      typeof card.due === "string" ? `due ${card.due}` : undefined,
      typeof card.updatedAt === "string" ? card.updatedAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof card.url === "string") {
      console.log(`   ${card.url}`);
    }
  }
}

export function printTrelloCardResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const card = result.data?.card as Record<string, unknown> | undefined;
  if (!card) {
    return;
  }

  if (typeof card.name === "string") {
    console.log(card.name);
  }

  const meta = [
    typeof card.shortLink === "string" ? card.shortLink : undefined,
    typeof card.due === "string" ? `due ${card.due}` : undefined,
    typeof card.updatedAt === "string" ? card.updatedAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof card.description === "string" && card.description.trim().length > 0) {
    console.log(card.description.trim());
  }
  if (typeof card.url === "string") {
    console.log(card.url);
  }
}
