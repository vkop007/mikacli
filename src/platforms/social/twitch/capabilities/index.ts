import { twitchLoginCapability, twitchMeCapability, twitchStatusCapability } from "./auth.js";
import {
  twitchChannelCapability,
  twitchClipsCapability,
  twitchSearchCapability,
  twitchStreamCapability,
  twitchVideosCapability,
} from "./read.js";

export const twitchCapabilities = [
  twitchLoginCapability,
  twitchStatusCapability,
  twitchMeCapability,
  twitchSearchCapability,
  twitchChannelCapability,
  twitchStreamCapability,
  twitchVideosCapability,
  twitchClipsCapability,
] as const;
