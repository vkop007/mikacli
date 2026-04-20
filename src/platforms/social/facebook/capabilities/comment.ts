import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parseBrowserTimeoutSeconds } from "../../../shared/cookie-login.js";
import { facebookAdapter } from "../adapter.js";

export const facebookCommentCapability = createAdapterActionCapability({
  id: "comment",
  command: "comment <target> <text>",
  description: "Comment on a Facebook post by post URL, timeline URL, or numeric object ID through a browser-backed flow using the latest saved session by default",
  spinnerText: "Sending Facebook comment...",
  successMessage: "Facebook comment sent.",
  options: [
    { flags: "--account <name>", description: "Optional override for a specific saved Facebook session" },
    { flags: "--browser", description: "Force the comment through the shared MikaCLI browser profile instead of the invisible browser-backed path" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ args, options }) =>
    facebookAdapter.comment({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      text: String(args[1] ?? ""),
      browser: Boolean(options.browser),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});
