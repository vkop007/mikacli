import { youtubeMusicLoginCapability } from "./auth.js";
import {
  youtubeMusicNextCapability,
  youtubeMusicPauseCapability,
  youtubeMusicPlayCapability,
  youtubeMusicPlaybackStatusCapability,
  youtubeMusicPreviousCapability,
  youtubeMusicQueueAddCapability,
  youtubeMusicQueueCapability,
  youtubeMusicStopCapability,
} from "./playback.js";
import {
  youtubeMusicAlbumIdCapability,
  youtubeMusicArtistIdCapability,
  youtubeMusicPlaylistIdCapability,
  youtubeMusicRelatedCapability,
  youtubeMusicSearchCapability,
  youtubeMusicSongIdCapability,
} from "./read.js";
import {
  youtubeMusicDislikeCapability,
  youtubeMusicLikeCapability,
  youtubeMusicUnlikeCapability,
} from "./write.js";

export const youtubeMusicCapabilities = [
  youtubeMusicLoginCapability,
  youtubeMusicPlaybackStatusCapability,
  youtubeMusicPlayCapability,
  youtubeMusicPauseCapability,
  youtubeMusicStopCapability,
  youtubeMusicNextCapability,
  youtubeMusicPreviousCapability,
  youtubeMusicQueueCapability,
  youtubeMusicQueueAddCapability,
  youtubeMusicSearchCapability,
  youtubeMusicSongIdCapability,
  youtubeMusicRelatedCapability,
  youtubeMusicAlbumIdCapability,
  youtubeMusicArtistIdCapability,
  youtubeMusicPlaylistIdCapability,
  youtubeMusicLikeCapability,
  youtubeMusicDislikeCapability,
  youtubeMusicUnlikeCapability,
] as const;
