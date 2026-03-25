import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printInstagramSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      username?: string;
      fullName?: string;
      followerCount?: number;
      isPrivate?: boolean;
      isVerified?: boolean;
      url?: string;
    };

    const meta = [
      typeof item.fullName === "string" ? item.fullName : undefined,
      typeof item.followerCount === "number" ? `${item.followerCount} followers` : undefined,
      item.isVerified ? "verified" : undefined,
      item.isPrivate ? "private" : "public",
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. @${item.username ?? "unknown"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }
}

export function printInstagramUserListResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      username?: string;
      fullName?: string;
      followerCount?: number;
      isPrivate?: boolean;
      isVerified?: boolean;
      url?: string;
    };

    const meta = [
      typeof item.fullName === "string" ? item.fullName : undefined,
      typeof item.followerCount === "number" ? `${item.followerCount} followers` : undefined,
      item.isVerified ? "verified" : undefined,
      item.isPrivate ? "private" : "public",
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. @${item.username ?? "unknown"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (item.url) {
      console.log(`   ${item.url}`);
    }
  }

  if (typeof result.data?.nextCursor === "string" && result.data.nextCursor.length > 0) {
    console.log(`next cursor: ${result.data.nextCursor}`);
  }
}

export function printInstagramDownloadResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const files = Array.isArray(result.data?.files) ? result.data.files : [];
  for (const rawFile of files) {
    if (typeof rawFile === "string" && rawFile.length > 0) {
      console.log(`file: ${rawFile}`);
    }
  }
}

export function printInstagramPostsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const posts = Array.isArray(result.data?.posts) ? result.data.posts : [];
  for (const [index, rawPost] of posts.entries()) {
    if (!rawPost || typeof rawPost !== "object") {
      continue;
    }

    const post = rawPost as {
      shortcode?: string;
      mediaType?: string;
      likeCount?: number;
      commentCount?: number;
      playCount?: number;
      takenAt?: string;
      url?: string;
      caption?: string;
    };

    const meta = [
      typeof post.shortcode === "string" ? post.shortcode : undefined,
      typeof post.mediaType === "string" ? post.mediaType : undefined,
      typeof post.likeCount === "number" ? `${post.likeCount} likes` : undefined,
      typeof post.commentCount === "number" ? `${post.commentCount} comments` : undefined,
      typeof post.playCount === "number" ? `${post.playCount} plays` : undefined,
      typeof post.takenAt === "string" ? post.takenAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${post.url ?? "Instagram post"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof post.caption === "string" && post.caption.length > 0) {
      const preview = post.caption.length > 180 ? `${post.caption.slice(0, 180)}...` : post.caption;
      console.log(`   ${preview.replace(/\s+/g, " ").trim()}`);
    }
  }
}

export function printInstagramStoriesResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const stories = Array.isArray(result.data?.stories) ? result.data.stories : [];
  for (const [index, rawStory] of stories.entries()) {
    if (!rawStory || typeof rawStory !== "object") {
      continue;
    }

    const story = rawStory as {
      mediaType?: string;
      takenAt?: string;
      expiresAt?: string;
      url?: string;
      assetUrl?: string;
    };

    const meta = [
      typeof story.mediaType === "string" ? story.mediaType : undefined,
      typeof story.takenAt === "string" ? story.takenAt : undefined,
      typeof story.expiresAt === "string" ? `expires ${story.expiresAt}` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${story.url ?? "Instagram story"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof story.assetUrl === "string" && story.assetUrl.length > 0) {
      console.log(`   asset: ${story.assetUrl}`);
    }
  }
}

export function printInstagramMediaResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.ownerUsername === "string" ? `@${data.ownerUsername}` : undefined,
    typeof data.mediaType === "string" ? data.mediaType : undefined,
    typeof data.likeCount === "number" ? `${data.likeCount} likes` : undefined,
    typeof data.commentCount === "number" ? `${data.commentCount} comments` : undefined,
    typeof data.playCount === "number" ? `${data.playCount} plays` : undefined,
    typeof data.takenAt === "string" ? data.takenAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.ownerUrl === "string") {
    console.log(`owner: ${data.ownerUrl}`);
  }

  if (typeof data.caption === "string" && data.caption.length > 0) {
    const preview = data.caption.length > 300 ? `${data.caption.slice(0, 300)}...` : data.caption;
    console.log(preview);
  }
}

export function printInstagramProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.fullName === "string" ? data.fullName : undefined,
    typeof data.followerCount === "number" ? `${data.followerCount} followers` : undefined,
    typeof data.followingCount === "number" ? `${data.followingCount} following` : undefined,
    typeof data.mediaCount === "number" ? `${data.mediaCount} posts` : undefined,
    data.isVerified ? "verified" : undefined,
    data.isPrivate ? "private" : "public",
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.externalUrl === "string" && data.externalUrl.length > 0) {
    console.log(`external: ${data.externalUrl}`);
  }

  if (typeof data.biography === "string" && data.biography.length > 0) {
    const preview = data.biography.length > 300 ? `${data.biography.slice(0, 300)}...` : data.biography;
    console.log(preview);
  }
}
