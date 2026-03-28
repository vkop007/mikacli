import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { notionAdapter, type NotionAdapter } from "../adapter.js";
import { printNotionIdentityResult } from "../output.js";

export function createNotionLoginCapability(adapter: NotionAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Import cookies and save the Notion web session for future CLI use",
    spinnerText: "Importing Notion session...",
    successMessage: "Notion session saved.",
    options: [
      { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
      { flags: "--account <name>", description: "Optional saved alias instead of the detected workspace/user" },
      { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
      { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
    ],
    action: ({ options }) =>
      adapter.login({
        account: options.account as string | undefined,
        cookieFile: options.cookies as string | undefined,
        cookieString: options.cookieString as string | undefined,
        cookieJson: options.cookieJson as string | undefined,
      }),
    onSuccess: printNotionIdentityResult,
  });
}

export const notionLoginCapability = createNotionLoginCapability(notionAdapter);
