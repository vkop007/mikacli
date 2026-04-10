import { trelloAdapter, type TrelloAdapter } from "../adapter.js";
import { createTrelloBoardCapability, createTrelloBoardsCapability, createTrelloListsCapability } from "./boards.js";
import { createTrelloCardCapability, createTrelloCardsCapability, createTrelloCreateCardCapability } from "./cards.js";
import { createTrelloLoginCapability } from "./login.js";
import { createTrelloMeCapability } from "./me.js";

import { createAdapterStatusCapability } from "../../../../core/runtime/capability-helpers.js";
import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createTrelloCapabilities(adapter: TrelloAdapter): readonly PlatformCapability[] {
  return [
    createTrelloLoginCapability(adapter),
    createAdapterStatusCapability({ adapter, subject: "session" }),
    createTrelloMeCapability(adapter),
    createTrelloBoardsCapability(adapter),
    createTrelloBoardCapability(adapter),
    createTrelloListsCapability(adapter),
    createTrelloCardsCapability(adapter),
    createTrelloCardCapability(adapter),
    createTrelloCreateCardCapability(adapter),
  ];
}

export const trelloCapabilities: readonly PlatformCapability[] = createTrelloCapabilities(trelloAdapter);
