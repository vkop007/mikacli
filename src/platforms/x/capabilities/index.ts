import { xCommentCapability } from "./comment.js";
import { xLikeCapability } from "./like.js";
import { xLoginCapability } from "./login.js";
import { xPostCapability } from "./post.js";
import { xProfileIdCapability } from "./profileid.js";
import { xSearchCapability } from "./search.js";
import { xTweetIdCapability } from "./tweetid.js";
import { xTweetsCapability } from "./tweets.js";
import { xUnlikeCapability } from "./unlike.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

export const xCapabilities: readonly PlatformCapability[] = [
  xLoginCapability,
  xPostCapability,
  xSearchCapability,
  xTweetIdCapability,
  xProfileIdCapability,
  xTweetsCapability,
  xLikeCapability,
  xUnlikeCapability,
  xCommentCapability,
];
