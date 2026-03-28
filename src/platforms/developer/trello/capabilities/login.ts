import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { trelloAdapter, type TrelloAdapter } from "../adapter.js";
import { printTrelloIdentityResult } from "../output.js";

export function createTrelloLoginCapability(adapter: TrelloAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Import cookies and save the ${adapter.displayName} web session for future CLI use`,
    spinnerText: `Importing ${adapter.displayName} session...`,
    successMessage: `${adapter.displayName} session saved.`,
    options: [
      { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
      { flags: "--account <name>", description: "Optional saved alias instead of the detected Trello account" },
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
    onSuccess: printTrelloIdentityResult,
  });
}

export const trelloLoginCapability = createTrelloLoginCapability(trelloAdapter);
