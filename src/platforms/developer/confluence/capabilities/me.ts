import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { confluenceAdapter, type ConfluenceAdapter } from "../adapter.js";
import { printConfluenceIdentityResult } from "../output.js";

export function createConfluenceMeCapability(adapter: ConfluenceAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    description: `Load the current ${adapter.displayName} account identity`,
    spinnerText: `Loading ${adapter.displayName} identity...`,
    successMessage: `${adapter.displayName} identity loaded.`,
    action: () => adapter.me(),
    onSuccess: printConfluenceIdentityResult,
  });
}

export const confluenceMeCapability = createConfluenceMeCapability(confluenceAdapter);
