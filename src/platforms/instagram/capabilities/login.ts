import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { instagramAdapter } from "../adapter.js";

export const instagramLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the Instagram session for future headless use",
  spinnerText: "Importing Instagram session...",
  successMessage: "Instagram session imported.",
  options: [
    { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
    { flags: "--account <name>", description: "Optional saved alias instead of the detected username" },
    { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
    { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
  ],
  action: ({ options }) =>
    instagramAdapter.login({
      account: options.account as string | undefined,
      cookieFile: options.cookies as string | undefined,
      cookieString: options.cookieString as string | undefined,
      cookieJson: options.cookieJson as string | undefined,
    }),
});
