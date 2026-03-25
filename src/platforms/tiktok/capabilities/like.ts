import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { tiktokAdapter } from "../adapter.js";

export const tiktokLikeCapability = createAdapterActionCapability({
  id: "like",
  command: "like <target>",
  description: "Like a TikTok video by URL or numeric item ID using the latest saved session by default",
  spinnerText: "Liking TikTok post...",
  successMessage: "TikTok post liked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved TikTok session" }],
  action: ({ args, options }) =>
    tiktokAdapter.like({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});
