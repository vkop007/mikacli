import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { trelloAdapter, type TrelloAdapter } from "../adapter.js";
import { printTrelloIdentityResult } from "../output.js";

export function createTrelloMeCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    aliases: ["whoami"],
    description: `Load the authenticated ${adapter.displayName} account`,
    spinnerText: `Loading ${adapter.displayName} account...`,
    successMessage: `${adapter.displayName} account loaded.`,
    action: () => adapter.me(),
    onSuccess: printTrelloIdentityResult,
  });
}

export const trelloMeCapability = createTrelloMeCapability(trelloAdapter);
