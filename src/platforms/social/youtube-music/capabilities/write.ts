import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { youtubeMusicAdapter } from "../adapter.js";

export const youtubeMusicLikeCapability = createAdapterActionCapability({
  id: "like",
  command: "like <target>",
  description: "Like a YouTube Music song or music-video by URL or ID",
  spinnerText: "Liking YouTube Music item...",
  successMessage: "YouTube Music item liked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" }],
  action: ({ args, options }) =>
    youtubeMusicAdapter.like({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const youtubeMusicDislikeCapability = createAdapterActionCapability({
  id: "dislike",
  command: "dislike <target>",
  description: "Dislike a YouTube Music song or music-video by URL or ID",
  spinnerText: "Disliking YouTube Music item...",
  successMessage: "YouTube Music item disliked.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" }],
  action: ({ args, options }) =>
    youtubeMusicAdapter.dislike({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});

export const youtubeMusicUnlikeCapability = createAdapterActionCapability({
  id: "unlike",
  command: "unlike <target>",
  description: "Clear the current like/dislike state for a YouTube Music song or music-video",
  spinnerText: "Clearing YouTube Music preference...",
  successMessage: "YouTube Music preference cleared.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved YouTube Music session" }],
  action: ({ args, options }) =>
    youtubeMusicAdapter.unlike({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
});
