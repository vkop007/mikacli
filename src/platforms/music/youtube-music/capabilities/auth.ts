import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { youtubeMusicAdapter } from "../adapter.js";

export const youtubeMusicLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the YouTube Music session for future headless use",
  spinnerText: "Importing YouTube Music session...",
  successMessage: "YouTube Music session imported.",
  options: [
    { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
    { flags: "--account <name>", description: "Optional saved alias instead of the default session name" },
    { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
    { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
  ],
  action: ({ options }) =>
    youtubeMusicAdapter.login({
      account: options.account as string | undefined,
      cookieFile: options.cookies as string | undefined,
      cookieString: options.cookieString as string | undefined,
      cookieJson: options.cookieJson as string | undefined,
    }),
});
