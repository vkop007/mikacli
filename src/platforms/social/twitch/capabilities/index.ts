import { twitchLoginCapability, twitchMeCapability, twitchStatusCapability } from "./auth.js";
import {
  twitchChannelCapability,
  twitchClipsCapability,
  twitchSearchCapability,
  twitchStreamCapability,
  twitchVideosCapability,
} from "./read.js";
import {
  twitchCreateClipCapability,
  twitchFollowCapability,
  twitchUnfollowCapability,
  twitchUpdateStreamCapability,
} from "./write.js";

export const twitchCapabilities = [
  twitchLoginCapability,
  twitchStatusCapability,
  twitchMeCapability,
  twitchSearchCapability,
  twitchChannelCapability,
  twitchStreamCapability,
  twitchVideosCapability,
  twitchClipsCapability,
  twitchFollowCapability,
  twitchUnfollowCapability,
  twitchCreateClipCapability,
  twitchUpdateStreamCapability,
] as const;
