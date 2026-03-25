import { youtubeLoginCapability } from "./auth.js";
import {
  youtubeCaptionsCapability,
  youtubeChannelIdCapability,
  youtubeDownloadCapability,
  youtubePlaylistIdCapability,
  youtubePostCapability,
  youtubeRelatedCapability,
  youtubeSearchCapability,
  youtubeUploadCapability,
  youtubeVideoIdCapability,
} from "./media.js";
import {
  youtubeCommentCapability,
  youtubeDislikeCapability,
  youtubeLikeCapability,
  youtubeSubscribeCapability,
  youtubeUnlikeCapability,
  youtubeUnsubscribeCapability,
} from "./write.js";

export const youtubeCapabilities = [
  youtubeLoginCapability,
  youtubeDownloadCapability,
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
  youtubeSubscribeCapability,
  youtubeUnsubscribeCapability,
] as const;
