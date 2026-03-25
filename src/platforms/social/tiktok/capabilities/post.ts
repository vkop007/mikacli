import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { tiktokAdapter } from "../adapter.js";

export const tiktokPostCapability = createAdapterActionCapability({
  id: "post",
  command: "post <mediaPath>",
  description: "Publish a TikTok video using the latest saved session by default",
  spinnerText: "Checking TikTok posting support...",
  successMessage: "TikTok post created.",
  options: [
    { flags: "--caption <text>", description: "Optional caption for the TikTok post" },
    { flags: "--account <name>", description: "Optional override for a specific saved TikTok session" },
  ],
  action: ({ args, options }) =>
    tiktokAdapter.postMedia({
      account: options.account as string | undefined,
      mediaPath: String(args[0] ?? ""),
      caption: options.caption as string | undefined,
    }),
});
