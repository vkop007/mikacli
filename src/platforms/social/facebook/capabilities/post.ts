import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parseBrowserTimeoutSeconds } from "../../../shared/cookie-login.js";
import { facebookAdapter } from "../adapter.js";

export const facebookPostCapability = createAdapterActionCapability({
  id: "post",
  command: "post <text>",
  description: "Publish a Facebook post through a browser-backed flow using the latest saved session by default",
  spinnerText: "Creating Facebook post...",
  successMessage: "Facebook post created.",
  options: [
    { flags: "--image <path>", description: "Optional image path to attach to the Facebook post" },
    { flags: "--account <name>", description: "Optional override for a specific saved Facebook session" },
    { flags: "--browser", description: "Force the post through the shared MikaCLI browser profile instead of the invisible browser-backed path" },
    {
      flags: "--browser-timeout <seconds>",
      description: "Maximum seconds to allow the browser action to complete",
      parser: parseBrowserTimeoutSeconds,
    },
  ],
  action: ({ args, options }) =>
    facebookAdapter.postText({
      account: options.account as string | undefined,
      text: String(args[0] ?? ""),
      imagePath: options.image as string | undefined,
      browser: Boolean(options.browser),
      browserTimeoutSeconds: options.browserTimeout as number | undefined,
    }),
});
