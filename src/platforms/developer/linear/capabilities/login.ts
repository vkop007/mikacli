import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearIdentityResult } from "../output.js";

export function createLinearLoginCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Import cookies and save the Linear web session for future CLI use",
    spinnerText: "Importing Linear session...",
    successMessage: "Linear session saved.",
    options: [
      { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
      { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
      { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
    ],
    action: ({ options }) =>
      adapter.login({
        cookieFile: options.cookies as string | undefined,
        cookieString: options.cookieString as string | undefined,
        cookieJson: options.cookieJson as string | undefined,
      }),
    onSuccess: printLinearIdentityResult,
  });
}

export const linearLoginCapability = createLinearLoginCapability(linearAdapter);
