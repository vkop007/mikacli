import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionIdentityResult } from "../output.js";

export function createNotionLoginCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Save a Notion integration token for future API calls",
    spinnerText: "Validating Notion token...",
    successMessage: "Notion token saved.",
    options: [{ flags: "--token <token>", description: "Notion integration token", required: true }],
    action: ({ options }) =>
      adapter.loginWithToken({
        token: String(options.token ?? ""),
      }),
    onSuccess: printNotionIdentityResult,
  });
}

export const notionLoginCapability = createNotionLoginCapability(notionAdapter);

