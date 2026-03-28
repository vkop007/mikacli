import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionIdentityResult } from "../output.js";

export function createNotionMeCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "me",
    command: "me",
    aliases: ["whoami"],
    description: "Load the authenticated Notion integration identity",
    spinnerText: "Loading Notion identity...",
    successMessage: "Notion identity loaded.",
    action: () => adapter.me(),
    onSuccess: printNotionIdentityResult,
  });
}

export const notionMeCapability = createNotionMeCapability(notionAdapter);

