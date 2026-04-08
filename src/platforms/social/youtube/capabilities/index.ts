import { youtubeLoginCapability, youtubeStatusCapability } from "./auth.js";
import {
  youtubeCaptionsCapability,
  youtubeChannelIdCapability,
  youtubePlaylistIdCapability,
  youtubePostCapability,
  youtubeRelatedCapability,
  youtubeSearchCapability,
  youtubeUploadCapability,
  youtubeVideoIdCapability,
} from "./media.js";
import {
  youtubeCommentCapability,
  youtubeDeleteCapability,
  youtubeDislikeCapability,
  youtubeLikeCapability,
  youtubeSubscribeCapability,
  youtubeUnlikeCapability,
  youtubeUnsubscribeCapability,
} from "./write.js";

export const youtubeCapabilities = [
  youtubeLoginCapability,
  youtubeStatusCapability,
  youtubeUploadCapability,
  youtubePostCapability,
  youtubeSearchCapability,
  youtubeVideoIdCapability,
  youtubeChannelIdCapability,
  youtubePlaylistIdCapability,
  youtubeRelatedCapability,
  youtubeCaptionsCapability,
  youtubeLikeCapability,
  youtubeDislikeCapability,
  youtubeUnlikeCapability,
  youtubeCommentCapability,
  youtubeDeleteCapability,
  youtubeSubscribeCapability,
  youtubeUnsubscribeCapability,
] as const;
