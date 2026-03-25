import { instagramBatchCapability } from "./batch.js";
import { instagramLoginCapability } from "./login.js";
import {
  instagramDownloadCapability,
  instagramDownloadPostsCapability,
  instagramFollowersCapability,
  instagramFollowingCapability,
  instagramMediaIdCapability,
  instagramPostsCapability,
  instagramProfileIdCapability,
  instagramSearchCapability,
  instagramStoriesCapability,
  instagramStoryDownloadCapability,
} from "./read.js";
import { instagramPostCapability } from "./post.js";
import {
  instagramCommentCapability,
  instagramFollowCapability,
  instagramLikeCapability,
  instagramUnfollowCapability,
  instagramUnlikeCapability,
} from "./write.js";

export const instagramCapabilities = [
  instagramLoginCapability,
  instagramPostCapability,
  instagramDownloadCapability,
  instagramSearchCapability,
  instagramPostsCapability,
  instagramStoriesCapability,
  instagramStoryDownloadCapability,
  instagramDownloadPostsCapability,
  instagramFollowersCapability,
  instagramFollowingCapability,
  instagramMediaIdCapability,
  instagramProfileIdCapability,
  instagramLikeCapability,
  instagramUnlikeCapability,
  instagramCommentCapability,
  instagramFollowCapability,
  instagramUnfollowCapability,
  instagramBatchCapability,
] as const;
