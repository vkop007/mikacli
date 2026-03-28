import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { jiraAdapter, type JiraAdapter } from "../adapter.js";
import { printJiraIdentityResult } from "../output.js";

export function createJiraMeCapability(adapter: JiraAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    aliases: ["whoami"],
    description: `Load the authenticated ${adapter.displayName} account`,
    spinnerText: `Loading ${adapter.displayName} account...`,
    successMessage: `${adapter.displayName} account loaded.`,
    action: () => adapter.me(),
    onSuccess: printJiraIdentityResult,
  });
}

export const jiraMeCapability = createJiraMeCapability(jiraAdapter);
