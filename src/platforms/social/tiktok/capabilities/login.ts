import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { tiktokAdapter } from "../adapter.js";

export const tiktokLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the TikTok session for future headless use",
  spinnerText: "Importing TikTok session...",
  successMessage: "TikTok session imported.",
  options: [
    { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
    { flags: "--account <name>", description: "Optional saved alias instead of the detected TikTok handle" },
    { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
    { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
  ],
  action: ({ options }) =>
    tiktokAdapter.login({
      account: options.account as string | undefined,
      cookieFile: options.cookies as string | undefined,
      cookieString: options.cookieString as string | undefined,
      cookieJson: options.cookieJson as string | undefined,
    }),
});
