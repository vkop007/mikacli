import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { MikaCliError } from "../../../errors.js";
import {
  runFirstClassBrowserAction,
  withBrowserActionMetadata,
} from "../../../core/runtime/browser-action-runtime.js";
import { maybeAutoRefreshSession } from "../../../utils/autorefresh.js";
import { serializeCookieJar } from "../../../utils/cookie-manager.js";
import { readMediaFile } from "../../../utils/media.js";
import { instagramMediaIdToShortcode, parseInstagramProfileTarget, parseInstagramTarget } from "../../../utils/targets.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { BasePlatformAdapter } from "../../shared/base-platform-adapter.js";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../../../types.js";
import type { Locator as PlaywrightLocator, Page as PlaywrightPage } from "playwright-core";

const INSTAGRAM_ORIGIN = getPlatformOrigin("instagram");
const INSTAGRAM_HOME = getPlatformHomeUrl("instagram");
const INSTAGRAM_APP_ID = "936619743392459";
const INSTAGRAM_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface InstagramProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

interface InstagramCurrentUserResponse {
  status?: string;
  user?: {
    pk?: string | number;
    username?: string;
    full_name?: string;
  };
  form_data?: {
    username?: string;
    first_name?: string;
  };
}

interface InstagramMutationResponse {
  status?: string;
  feedback_message?: string;
  media?: {
    id?: string;
    code?: string;
  };
  friendship_status?: {
    following?: boolean;
    outgoing_request?: boolean;
  };
  previous_following?: boolean;
  error?: string | null;
}

interface InstagramCommentMutationResponse {
  id?: string | number;
  pk?: string | number;
  text?: string;
  status?: string;
}

interface InstagramSearchResponse {
  users?: Array<{
    position?: number;
    user?: InstagramUserPayload;
  }>;
}

interface InstagramUserPayload {
  pk?: string | number;
  id?: string | number;
  username?: string;
  full_name?: string;
  biography?: string;
  external_url?: string | null;
  is_private?: boolean;
  is_verified?: boolean;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  edge_followed_by?: {
    count?: number;
  };
  edge_follow?: {
    count?: number;
  };
  edge_owner_to_timeline_media?: {
    count?: number;
  };
  follower_count?: number;
  following_count?: number;
  media_count?: number;
}

interface InstagramProfileInfoResponse {
  status?: string;
  data?: {
    user?: InstagramUserPayload;
  };
  user?: InstagramUserPayload;
}

interface InstagramMediaInfoResponse {
  status?: string;
  items?: InstagramMediaPayload[];
}

interface InstagramMediaPayload {
  id?: string;
  pk?: string | number;
  code?: string;
  media_type?: number;
  product_type?: string;
  is_video?: boolean;
  like_count?: number;
  comment_count?: number;
  play_count?: number;
  view_count?: number;
  taken_at?: number;
  expiring_at?: number;
  user?: InstagramUserPayload;
  caption?: {
    text?: string;
  };
  image_versions2?: {
    candidates?: Array<{
      url?: string;
    }>;
  };
  video_versions?: Array<{
    url?: string;
  }>;
  carousel_media?: InstagramMediaPayload[];
}

interface InstagramUserFeedResponse {
  items?: InstagramMediaPayload[];
  num_results?: number;
  more_available?: boolean;
}

interface InstagramFriendshipListResponse {
  users?: InstagramUserPayload[];
  next_max_id?: string;
  has_more?: boolean;
  page_size?: number;
  big_list?: boolean;
}

interface InstagramStoryResponse {
  reel?: {
    id?: string;
    user?: InstagramUserPayload;
    expiring_at?: number;
    items?: InstagramMediaPayload[];
  } | null;
  status?: string;
}

interface InstagramPostSummary {
  id: string;
  shortcode?: string;
  url?: string;
  mediaType?: string;
  likeCount?: number;
  commentCount?: number;
  playCount?: number;
  caption?: string;
  takenAt?: string;
  thumbnailUrl?: string;
  ownerUsername?: string;
}

interface InstagramDownloadAsset {
  url: string;
  extension: string;
  mediaType: string;
  index: number;
}

interface InstagramStoryItem {
  id: string;
  url?: string;
  mediaType?: string;
  takenAt?: string;
  expiresAt?: string;
  thumbnailUrl?: string;
  assetUrl?: string;
 }

interface InstagramSearchResultItem {
  id: string;
  username: string;
  fullName?: string;
  url: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  followerCount?: number;
  profilePicUrl?: string;
}

interface InstagramProfileInfo {
  id: string;
  username?: string;
  fullName?: string;
  biography?: string;
  url?: string;
  externalUrl?: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  followerCount?: number;
  followingCount?: number;
  mediaCount?: number;
  profilePicUrl?: string;
}

interface InstagramMediaInfo {
  id: string;
  shortcode?: string;
  url?: string;
  ownerUsername?: string;
  ownerUrl?: string;
  mediaType?: string;
  likeCount?: number;
  commentCount?: number;
  playCount?: number;
  caption?: string;
  takenAt?: string;
  thumbnailUrl?: string;
}

type InstagramPostFilter = "all" | "photo" | "video" | "reel" | "carousel";

export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = "instagram" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const provisionalSession = {
      version: 1 as const,
      platform: this.platform,
      account: input.account ?? "default",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: imported.source,
      status: { state: "unknown" as const },
      cookieJar: serializeCookieJar(imported.jar),
    };

    const probe = await this.probeSession(provisionalSession);
    const account = input.account ?? probe.user?.username ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      user: probe.user,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "Instagram session has expired.", {
        details: {
          platform: this.platform,
          account,
          sessionPath,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message:
        probe.status.state === "active"
          ? `Saved Instagram session for ${account}.`
          : `Saved Instagram session for ${account}, but it should be revalidated before heavy use.`,
      user: probe.user,
      sessionPath,
      data: {
        status: probe.status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.prepareSession(account);
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);
    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: probe.status,
      user: probe.user,
    });
  }

  async statusAction(account?: string): Promise<AdapterActionResult> {
    const status = await this.getStatus(account);
    return {
      ok: true,
      platform: this.platform,
      account: status.account,
      action: "status",
      message: `Instagram session is ${status.status}.`,
      user: status.user,
      sessionPath: status.sessionPath,
      data: {
        connected: status.connected,
        status: status.status,
        details: status.message,
        lastValidatedAt: status.lastValidatedAt,
      },
    };
  }

  async postMedia(input: PostMediaInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const media = await readMediaFile(input.mediaPath);
    if (!media.mimeType.startsWith("image/")) {
      throw new MikaCliError(
        "UNSUPPORTED_ACTION",
        "Instagram post currently supports image uploads only. Video and reel publishing are not implemented yet.",
        {
          details: {
            mediaPath: input.mediaPath,
            mimeType: media.mimeType,
          },
        },
      );
    }

    const client = await this.createInstagramClient(session);
    const uploadId = `${Date.now()}`;
    const entityName = `${uploadId}_0_${randomUUID()}`;

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/rupload_igphoto/${uploadId}`, {
            method: "POST",
            responseType: "text",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/octet-stream",
              offset: "0",
              "x-entity-name": entityName,
              "x-entity-type": media.mimeType,
              "x-entity-length": String(media.bytes.length),
              "x-instagram-rupload-params": JSON.stringify({
                media_type: 1,
                upload_id: uploadId,
                upload_media_width: 1080,
                upload_media_height: 1350,
                image_compression: JSON.stringify({
                  lib_name: "moz",
                  lib_version: "3.1.m",
                  quality: "80",
                }),
              }),
              referer: `${INSTAGRAM_ORIGIN}/create/style/`,
            },
            body: new Uint8Array(media.bytes),
          }),
      ],
      "Failed to upload media to Instagram. The private web upload flow may have changed.",
    );

    const configureResponse = await this.tryRequestChain<InstagramMutationResponse>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/media/configure/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
              referer: `${INSTAGRAM_ORIGIN}/create/details/`,
            },
            body: new URLSearchParams({
              upload_id: uploadId,
              caption: input.caption ?? "",
              source_type: "library",
              timezone_offset: "0",
              disable_comments: "0",
              like_and_view_counts_disabled: "0",
            }),
          }),
      ],
      "Failed to configure the Instagram post after upload.",
    );

    const postId = configureResponse.media?.id ?? uploadId;
    const shortcode = configureResponse.media?.code;
    const url = shortcode ? `${INSTAGRAM_ORIGIN}/p/${shortcode}/` : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "post",
      message: `Instagram post created for ${session.account}.`,
      id: postId,
      url,
      user: probe.user,
      data: {
        caption: input.caption ?? "",
        mediaPath: input.mediaPath,
      },
    };
  }

  async postText(_input: TextPostInput): Promise<AdapterActionResult> {
    throw new MikaCliError(
      "UNSUPPORTED_ACTION",
      "Instagram web sessions cannot publish a text-only post. Use `mikacli social instagram post <media-path> --caption ...`.",
    );
  }

  async download(input: {
    account?: string;
    target: string;
    outputDir?: string;
    all?: boolean;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);
    const response = await client.request<InstagramMediaInfoResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/media/${target.mediaId}/info/`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const media = response.items?.[0];
    if (!media?.id && !media?.pk) {
      throw new MikaCliError("INSTAGRAM_MEDIA_NOT_FOUND", "Instagram could not find that media item.", {
        details: {
          target: input.target,
          mediaId: target.mediaId,
        },
      });
    }

    const assets = this.extractInstagramDownloadAssets(media, Boolean(input.all));
    if (assets.length === 0) {
      throw new MikaCliError("INSTAGRAM_DOWNLOAD_UNAVAILABLE", "Instagram did not expose any downloadable media URLs for that item.", {
        details: {
          target: input.target,
          mediaId: target.mediaId,
        },
      });
    }

    const info = this.toInstagramMediaInfo(media, target.url);
    const outputDir = resolve(input.outputDir ?? join(process.cwd(), "downloads", "instagram"));
    await mkdir(outputDir, { recursive: true });

    const savedFiles: string[] = [];
    for (const asset of assets) {
      const response = await client.requestWithResponse<ArrayBuffer>(asset.url, {
        responseType: "arrayBuffer",
        expectedStatus: 200,
        headers: {
          referer: info.url ?? INSTAGRAM_HOME,
        },
      });

      const extension = this.normalizeInstagramDownloadExtension(
        asset.extension,
        response.response.headers.get("content-type") ?? undefined,
      );
      const filename = this.buildInstagramDownloadFilename({
        info,
        mediaType: asset.mediaType,
        index: asset.index,
        extension,
        includeIndex: assets.length > 1,
      });
      const outputPath = join(outputDir, filename);
      await writeFile(outputPath, Buffer.from(response.data));
      savedFiles.push(outputPath);
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "download",
      message: `Instagram download completed for ${session.account}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: {
        outputPath: savedFiles[0],
        files: savedFiles,
        outputDir,
        all: Boolean(input.all),
      },
    };
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/likes/${target.mediaId}/like/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/likes/${target.mediaId}/like/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
      ],
      "Failed to like the Instagram post.",
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `Instagram post liked for ${session.account}.`,
      id: target.mediaId,
      user: probe.user,
    };
  }

  async posts(input: {
    account?: string;
    target: string;
    limit?: number;
    type?: InstagramPostFilter;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const profile = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);
    const limit = this.normalizeSearchLimit(input.limit);
    const type = this.normalizeInstagramPostFilter(input.type);

    const response = await client.request<InstagramUserFeedResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/feed/user/${encodeURIComponent(profile.id)}/?count=${type === "all" ? limit : 25}`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const posts = (response.items ?? [])
      .filter((item) => this.matchesInstagramPostFilter(item, type))
      .slice(0, limit)
      .map((item) => this.toInstagramPostSummary(item));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "posts",
      message:
        posts.length > 0
          ? `Loaded ${posts.length} Instagram post${posts.length === 1 ? "" : "s"} for ${profile.username ?? profile.id}.`
          : `No Instagram posts found for ${profile.username ?? profile.id}.`,
      id: profile.id,
      url: profile.url,
      user: probe.user,
      data: {
        profile: { ...profile },
        limit,
        type,
        posts: posts.map((post) => ({ ...post })),
      },
    };
  }

  async followers(input: {
    account?: string;
    target: string;
    limit?: number;
    cursor?: string;
  }): Promise<AdapterActionResult> {
    return this.listFriendships({
      ...input,
      kind: "followers",
    });
  }

  async following(input: {
    account?: string;
    target: string;
    limit?: number;
    cursor?: string;
  }): Promise<AdapterActionResult> {
    return this.listFriendships({
      ...input,
      kind: "following",
    });
  }

  async stories(input: {
    account?: string;
    target: string;
    limit?: number;
    photosOnly?: boolean;
    videosOnly?: boolean;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const profile = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);
    const limit = this.normalizeSearchLimit(input.limit);
    const storyItems = await this.fetchInstagramStoryItems(client, probe.metadata, profile.id);
    const mediaFilter = this.normalizeInstagramStoryMediaFilter(input);
    const items = storyItems
      .filter((item) => this.matchesInstagramStoryMediaFilter(item, mediaFilter))
      .slice(0, limit)
      .map((item) => this.toInstagramStoryItem(item));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "stories",
      message:
        items.length > 0
          ? `Loaded ${items.length} Instagram stor${items.length === 1 ? "y" : "ies"} for ${profile.username ?? profile.id}.`
          : `No active Instagram stories found for ${profile.username ?? profile.id}.`,
      id: profile.id,
      url: profile.url,
      user: probe.user,
      data: {
        profile: { ...profile },
        limit,
        mediaFilter,
        stories: items.map((item) => ({ ...item })),
      },
    };
  }

  async storyDownload(input: {
    account?: string;
    target: string;
    limit?: number;
    outputDir?: string;
    photosOnly?: boolean;
    videosOnly?: boolean;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const profile = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);
    const limit = this.normalizeSearchLimit(input.limit);
    const storyItems = await this.fetchInstagramStoryItems(client, probe.metadata, profile.id);
    const mediaFilter = this.normalizeInstagramStoryMediaFilter(input);
    const selectedItems = storyItems.filter((item) => this.matchesInstagramStoryMediaFilter(item, mediaFilter)).slice(0, limit);

    if (selectedItems.length === 0) {
      throw new MikaCliError("INSTAGRAM_STORIES_UNAVAILABLE", `No active Instagram stories found for ${profile.username ?? profile.id}.`, {
        details: {
          target: input.target,
          profileId: profile.id,
        },
      });
    }

    const outputDir = resolve(
      input.outputDir ?? join(process.cwd(), "downloads", "instagram", "stories", this.sanitizeFilename(profile.username ?? profile.id)),
    );
    await mkdir(outputDir, { recursive: true });

    const savedFiles: string[] = [];
    for (const [index, item] of selectedItems.entries()) {
      const assetUrl = item.video_versions?.[0]?.url ?? item.image_versions2?.candidates?.[0]?.url;
      if (!assetUrl) {
        continue;
      }

      const story = this.toInstagramStoryItem(item);
      const response = await client.requestWithResponse<ArrayBuffer>(assetUrl, {
        responseType: "arrayBuffer",
        expectedStatus: 200,
        headers: {
          referer: story.url ?? profile.url ?? INSTAGRAM_HOME,
        },
      });

      const extension = this.normalizeInstagramDownloadExtension(
        this.extensionFromUrl(assetUrl),
        response.response.headers.get("content-type") ?? undefined,
      );
      const filename = this.buildInstagramStoryDownloadFilename({
        profile,
        storyId: story.id,
        mediaType: story.mediaType ?? (item.video_versions?.[0]?.url ? "video" : "image"),
        index,
        extension,
        includeIndex: selectedItems.length > 1,
      });
      const outputPath = join(outputDir, filename);
      await writeFile(outputPath, Buffer.from(response.data));
      savedFiles.push(outputPath);
    }

    if (savedFiles.length === 0) {
      throw new MikaCliError("INSTAGRAM_STORY_DOWNLOAD_UNAVAILABLE", "Instagram did not expose any downloadable story assets for that profile.", {
        details: {
          target: input.target,
          profileId: profile.id,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "storydownload",
      message: `Instagram story download completed for ${profile.username ?? profile.id}.`,
      id: profile.id,
      url: profile.url,
      user: probe.user,
      data: {
        profile: { ...profile },
        outputPath: savedFiles[0],
        files: savedFiles,
        outputDir,
        limit,
        mediaFilter,
      },
    };
  }

  async downloadPosts(input: {
    account?: string;
    target: string;
    limit?: number;
    outputDir?: string;
    all?: boolean;
    type?: InstagramPostFilter;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const profile = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);
    const limit = this.normalizeSearchLimit(input.limit);
    const type = this.normalizeInstagramPostFilter(input.type);

    const response = await client.request<InstagramUserFeedResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/feed/user/${encodeURIComponent(profile.id)}/?count=${type === "all" ? limit : 25}`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const posts = (response.items ?? []).filter((item) => this.matchesInstagramPostFilter(item, type)).slice(0, limit);
    if (posts.length === 0) {
      throw new MikaCliError("INSTAGRAM_POSTS_UNAVAILABLE", `No Instagram posts found for ${profile.username ?? profile.id}.`, {
        details: {
          target: input.target,
          profileId: profile.id,
          type,
        },
      });
    }

    const outputDir = resolve(
      input.outputDir ?? join(process.cwd(), "downloads", "instagram", "posts", this.sanitizeFilename(profile.username ?? profile.id)),
    );
    await mkdir(outputDir, { recursive: true });

    const savedFiles: string[] = [];
    for (const post of posts) {
      const info = this.toInstagramMediaInfo(post);
      const assets = this.extractInstagramDownloadAssets(post, Boolean(input.all));
      for (const asset of assets) {
        const response = await client.requestWithResponse<ArrayBuffer>(asset.url, {
          responseType: "arrayBuffer",
          expectedStatus: 200,
          headers: {
            referer: info.url ?? profile.url ?? INSTAGRAM_HOME,
          },
        });

        const extension = this.normalizeInstagramDownloadExtension(
          asset.extension,
          response.response.headers.get("content-type") ?? undefined,
        );
        const filename = this.buildInstagramDownloadFilename({
          info,
          mediaType: asset.mediaType,
          index: asset.index,
          extension,
          includeIndex: assets.length > 1,
        });
        const outputPath = join(outputDir, filename);
        await writeFile(outputPath, Buffer.from(response.data));
        savedFiles.push(outputPath);
      }
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "downloadposts",
      message: `Instagram post download completed for ${profile.username ?? profile.id}.`,
      id: profile.id,
      url: profile.url,
      user: probe.user,
      data: {
        profile: { ...profile },
        outputPath: savedFiles[0],
        files: savedFiles,
        outputDir,
        limit,
        type,
        all: Boolean(input.all),
        postsDownloaded: posts.length,
      },
    };
  }

  async unlike(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    await this.tryRequestChain(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/likes/${target.mediaId}/unlike/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/likes/${target.mediaId}/unlike/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildInstagramHeaders(client, probe.metadata),
          }),
      ],
      "Failed to unlike the Instagram post.",
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unlike",
      message: `Instagram post unliked for ${session.account}.`,
      id: target.mediaId,
      user: probe.user,
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    const response = await this.tryRequestChain<InstagramCommentMutationResponse>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/web/comments/${target.mediaId}/add/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              comment_text: input.text,
            }),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/web/comments/${target.mediaId}/add/`, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: {
              ...(await this.buildInstagramHeaders(client, probe.metadata)),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              comment_text: input.text,
            }),
          }),
      ],
      "Failed to comment on the Instagram post.",
    );
    const commentId = extractInstagramCommentId(response);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `Instagram comment sent for ${session.account}.`,
      id: commentId ?? target.mediaId,
      user: probe.user,
      data: {
        text: input.text,
        commentId,
        targetMediaId: target.mediaId,
      },
    };
  }

  async deletePost(input: LikeInput & { browser?: boolean; browserTimeoutSeconds?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadSession(input.account);
    const session = loaded.session;
    const path = loaded.path;
    const target = this.resolveInstagramPermalink(input.target);
    const targetUrl = target.url;

    const timeoutSeconds = input.browserTimeoutSeconds ?? 90;
    const steps = input.browser
      ? [{
          source: "shared" as const,
          announceLabel: `Opening shared MikaCLI browser profile for Instagram deletion: ${targetUrl}`,
        }]
      : [
          { source: "headless" as const, shouldContinueOnError: () => true },
          {
            source: "shared" as const,
            announceLabel: `Opening shared MikaCLI browser profile for Instagram deletion: ${targetUrl}`,
          },
        ];

    const execution = await runFirstClassBrowserAction<{
      finalUrl?: string;
      source: "headless" | "profile" | "shared";
    }>({
      platform: this.platform,
      action: "delete",
      actionLabel: "delete",
      targetUrl,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: INSTAGRAM_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps,
      actionFn: async (page, source) => {
        await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(1_500);
        await this.ensureInstagramBrowserAuthenticated(page);
        if (!page.url().includes(target.shortcode)) {
          await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
          });
          await page.waitForTimeout(1_500);
        }
        await this.waitForInstagramPostPage(page, target.shortcode, targetUrl);
        await this.openInstagramPostActionMenu(page);

        const deleteAction = await firstVisibleInstagramLocator(page, [
          'div[role="button"]:has-text("Delete")',
          'button:has-text("Delete")',
        ]);
        await clickInstagramLocator(deleteAction);
        await page.waitForTimeout(400);

        const confirmButton = await this.waitForInstagramDeleteConfirmButton(page);
        await clickInstagramLocator(confirmButton);
        await this.waitForInstagramPostRemoval(page, targetUrl);

        return {
          finalUrl: page.url(),
          source,
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "delete",
      message: `Instagram post deleted for ${session.account} through a browser-backed flow.`,
      id: target.mediaId,
      url: execution.value.finalUrl ?? targetUrl,
      user: session.user,
      sessionPath: path,
      data: {
        target: target.mediaId,
        shortcode: target.shortcode,
      },
    }, execution);
  }

  async deleteComment(input: {
    account?: string;
    target: string;
    commentId: string;
    browser?: boolean;
    browserTimeoutSeconds?: number;
  }): Promise<AdapterActionResult> {
    const loaded = await this.loadSession(input.account);
    const session = loaded.session;
    const path = loaded.path;
    const target = this.resolveInstagramPermalink(input.target);
    const commentId = normalizeInstagramCommentId(input.commentId);
    const timeoutSeconds = input.browserTimeoutSeconds ?? 90;
    const steps = input.browser
      ? [{
          source: "shared" as const,
          announceLabel: `Opening shared MikaCLI browser profile for Instagram comment deletion: ${target.url}`,
        }]
      : [
          { source: "headless" as const, shouldContinueOnError: () => true },
          {
            source: "shared" as const,
            announceLabel: `Opening shared MikaCLI browser profile for Instagram comment deletion: ${target.url}`,
          },
        ];

    const execution = await runFirstClassBrowserAction<{
      endpoint?: string;
      finalUrl?: string;
      source: "headless" | "profile" | "shared";
    }>({
      platform: this.platform,
      action: "delete-comment",
      actionLabel: "delete comment",
      targetUrl: target.url,
      timeoutSeconds,
      initialCookies: session.cookieJar.cookies,
      headless: true,
      userAgent: INSTAGRAM_USER_AGENT,
      locale: "en-US",
      mode: "required",
      steps,
      actionFn: async (page, source) => {
        await page.goto(target.url, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(1_500);
        await this.ensureInstagramBrowserAuthenticated(page);
        if (!page.url().includes(target.shortcode)) {
          await page.goto(target.url, {
            waitUntil: "domcontentloaded",
          });
          await page.waitForTimeout(1_500);
        }
        await this.waitForInstagramPostPage(page, target.shortcode, target.url);

        const response = await page.evaluate(
          async ({ mediaId, commentId, appId }) => {
            const csrfMatch = document.cookie.match(/(?:^|;\\s*)csrftoken=([^;]+)/u);
            const csrfToken = csrfMatch?.[1] ? decodeURIComponent(csrfMatch[1]) : "";
            const headers = {
              accept: "*/*",
              "content-type": "application/x-www-form-urlencoded",
              "x-asbd-id": "129477",
              "x-csrftoken": csrfToken,
              "x-ig-app-id": appId,
              "x-requested-with": "XMLHttpRequest",
            };
            const attempts: Array<Record<string, string | number | boolean>> = [];

            for (const endpoint of [
              `/web/comments/${mediaId}/delete/${commentId}/`,
              `/api/v1/web/comments/${mediaId}/delete/${commentId}/`,
            ]) {
              try {
                const result = await fetch(endpoint, {
                  method: "POST",
                  credentials: "include",
                  headers,
                  body: "",
                });
                const body = await result.text();
                let status = "";
                try {
                  const parsed = JSON.parse(body) as { status?: unknown };
                  status = typeof parsed.status === "string" ? parsed.status : "";
                } catch {
                  status = "";
                }

                attempts.push({
                  endpoint,
                  httpStatus: result.status,
                  ok: result.ok,
                  status,
                });
                if (result.ok && (!status || status === "ok")) {
                  return {
                    ok: true,
                    endpoint,
                    httpStatus: result.status,
                  };
                }
              } catch (error) {
                attempts.push({
                  endpoint,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            return {
              ok: false,
              attempts,
            };
          },
          {
            mediaId: target.mediaId,
            commentId,
            appId: INSTAGRAM_APP_ID,
          },
        );

        if (!response.ok) {
          throw new MikaCliError("PLATFORM_REQUEST_FAILED", "Failed to delete the Instagram comment.", {
            details: {
              mediaId: target.mediaId,
              commentId,
              attempts: response.attempts,
            },
          });
        }

        return {
          endpoint: response.endpoint,
          finalUrl: page.url(),
          source,
        };
      },
    });

    return withBrowserActionMetadata({
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "delete-comment",
      message: `Instagram comment deleted for ${session.account} through a browser-backed flow.`,
      id: commentId,
      url: execution.value.finalUrl ?? target.url,
      user: session.user,
      sessionPath: path,
      data: {
        targetMediaId: target.mediaId,
        commentId,
        endpoint: execution.value.endpoint,
      },
    }, execution);
  }

  async search(input: {
    account?: string;
    query: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const query = input.query.trim();

    if (!query) {
      throw new MikaCliError("INVALID_SEARCH_QUERY", "Expected a non-empty Instagram search query.");
    }

    const limit = this.normalizeSearchLimit(input.limit);
    const response = await client.request<InstagramSearchResponse>(
      `${INSTAGRAM_ORIGIN}/web/search/topsearch/?context=blended&count=${limit}&query=${encodeURIComponent(query)}`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const results = (response.users ?? [])
      .map((item) => item.user)
      .filter((user): user is InstagramUserPayload => Boolean(user?.username))
      .slice(0, limit)
      .map((user) => this.toInstagramSearchResult(user));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "search",
      message:
        results.length > 0
          ? `Found ${results.length} Instagram account result${results.length === 1 ? "" : "s"} for "${query}".`
          : `No Instagram account results found for "${query}".`,
      user: probe.user,
      data: {
        query,
        limit,
        results: results.map((result) => ({ ...result })),
      },
    };
  }

  async mediaInfo(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const target = parseInstagramTarget(input.target);

    const response = await client.request<InstagramMediaInfoResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/media/${target.mediaId}/info/`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const media = response.items?.[0];
    if (!media?.id && !media?.pk) {
      throw new MikaCliError("INSTAGRAM_MEDIA_NOT_FOUND", "Instagram could not find that media item.", {
        details: {
          target: input.target,
          mediaId: target.mediaId,
        },
      });
    }

    const info = this.toInstagramMediaInfo(media, target.url);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "mediaid",
      message: `Loaded Instagram media details for ${info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: { ...info },
    };
  }

  async profileInfo(input: {
    account?: string;
    target: string;
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const info = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "profileid",
      message: `Loaded Instagram profile details for ${info.username ?? info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: { ...info },
    };
  }

  async follow(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const info = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);

    const response = await client.request<InstagramMutationResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/friendships/create/${info.id}/`,
      {
        method: "POST",
        expectedStatus: 200,
        headers: {
          ...(await this.buildInstagramHeaders(client, probe.metadata)),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(),
      },
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "follow",
      message: `Instagram follow request sent for ${info.username ?? info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: {
        username: info.username,
        following: response.friendship_status?.following,
        outgoingRequest: response.friendship_status?.outgoing_request,
      },
    };
  }

  async unfollow(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const info = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);

    const response = await client.request<InstagramMutationResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/friendships/destroy/${info.id}/`,
      {
        method: "POST",
        expectedStatus: 200,
        headers: {
          ...(await this.buildInstagramHeaders(client, probe.metadata)),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(),
      },
    );

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "unfollow",
      message: `Instagram unfollow request sent for ${info.username ?? info.id}.`,
      id: info.id,
      url: info.url,
      user: probe.user,
      data: {
        username: info.username,
        following: response.friendship_status?.following,
        previousFollowing: response.previous_following,
      },
    };
  }

  private async ensureActiveSession(session: PlatformSession): Promise<InstagramProbe> {
    const probe = await this.probeSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new MikaCliError("SESSION_EXPIRED", probe.status.message ?? "Instagram session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    return probe;
  }

  private async probeSession(session: PlatformSession): Promise<InstagramProbe> {
    const client = await this.createInstagramClient(session);
    const sessionId = await client.getCookieValue("sessionid", INSTAGRAM_HOME);
    const csrfToken = await client.getCookieValue("csrftoken", INSTAGRAM_HOME);
    const dsUserId = await client.getCookieValue("ds_user_id", INSTAGRAM_HOME);

    if (!sessionId || !csrfToken) {
      return {
        status: {
          state: "expired",
          message: "Missing required Instagram session cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    const homeHtml = await client.request<string>(INSTAGRAM_HOME, {
      responseType: "text",
      expectedStatus: 200,
      headers: {
        "user-agent": INSTAGRAM_USER_AGENT,
      },
    });

    const inlineUser = this.extractUserFromHtml(homeHtml, dsUserId);
    const appId = this.extractFirst(homeHtml, /"app_id":"([^"]+)"/u) ?? INSTAGRAM_APP_ID;
    const deviceId = this.extractFirst(homeHtml, /"device_id":"([^"]+)"/u);

    const apiUser = await this.tryRequestChain<InstagramCurrentUserResponse | null>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/accounts/current_user/?edit=true`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, { appId, deviceId }),
          }),
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/accounts/edit/web_form_data/`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, { appId, deviceId }),
          }),
      ],
      "",
      true,
    );

    const user: SessionUser | undefined =
      apiUser?.user
        ? {
            id: String(apiUser.user.pk ?? dsUserId ?? ""),
            username: apiUser.user.username ?? inlineUser?.username,
            displayName: apiUser.user.full_name ?? inlineUser?.displayName,
            profileUrl: apiUser.user.username ? `${INSTAGRAM_ORIGIN}/${apiUser.user.username}/` : inlineUser?.profileUrl,
          }
        : apiUser?.form_data?.username || inlineUser
          ? {
              id: dsUserId,
              username: apiUser?.form_data?.username ?? inlineUser?.username,
              displayName: apiUser?.form_data?.first_name ?? inlineUser?.displayName,
              profileUrl:
                apiUser?.form_data?.username ?? inlineUser?.username
                  ? `${INSTAGRAM_ORIGIN}/${apiUser?.form_data?.username ?? inlineUser?.username}/`
                  : undefined,
            }
          : undefined;

    if (!apiUser && !user) {
      return {
        status: {
          state: "expired",
          message: "Instagram did not expose a logged-in user for these cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "LOGGED_OUT",
        },
        metadata: {
          appId,
          deviceId,
        },
      };
    }

    return {
      status: {
        state: apiUser ? "active" : "unknown",
        message:
          apiUser
            ? "Session validated."
            : "Homepage includes logged-in user data, but the validation endpoint was unavailable.",
        lastValidatedAt: new Date().toISOString(),
      },
      user,
      metadata: {
        appId,
        deviceId,
      },
    };
  }

  private async createInstagramClient(session: PlatformSession) {
    return this.createClient(session, {
      accept: "*/*",
      origin: INSTAGRAM_ORIGIN,
      "user-agent": INSTAGRAM_USER_AGENT,
    });
  }

  private async buildInstagramHeaders(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata?: Record<string, unknown>,
  ): Promise<Record<string, string>> {
    const csrfToken = await client.getCookieValue("csrftoken", INSTAGRAM_HOME);
    return {
      accept: "*/*",
      origin: INSTAGRAM_ORIGIN,
      referer: INSTAGRAM_HOME,
      "x-asbd-id": "129477",
      "x-csrftoken": csrfToken ?? "",
      "x-ig-app-id": String(metadata?.appId ?? INSTAGRAM_APP_ID),
      "x-requested-with": "XMLHttpRequest",
    };
  }

  private extractUserFromHtml(html: string, dsUserId?: string): SessionUser | undefined {
    const username =
      this.extractFirst(html, /"username":"([^"]+)"/u) ??
      this.extractFirst(html, /"forceLoginUsername":"([^"]+)"/u);
    const displayName = this.extractFirst(html, /"full_name":"([^"]+)"/u);

    if (!username && !displayName && !dsUserId) {
      return undefined;
    }

    return {
      id: dsUserId,
      username: username ?? undefined,
      displayName: displayName ?? undefined,
      profileUrl: username ? `${INSTAGRAM_ORIGIN}/${username}/` : undefined,
    };
  }

  private extractFirst(input: string, pattern: RegExp): string | undefined {
    return input.match(pattern)?.[1];
  }

  private normalizeSearchLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 5;
    }

    return Math.max(1, Math.min(25, Math.floor(limit)));
  }

  private normalizeInstagramPostFilter(type?: InstagramPostFilter): InstagramPostFilter {
    return type ?? "all";
  }

  private normalizeInstagramStoryMediaFilter(input: {
    photosOnly?: boolean;
    videosOnly?: boolean;
  }): "all" | "photo" | "video" {
    if (input.photosOnly && input.videosOnly) {
      throw new MikaCliError("INVALID_MEDIA_FILTER", "Use either --photos-only or --videos-only, not both.");
    }

    if (input.photosOnly) {
      return "photo";
    }

    if (input.videosOnly) {
      return "video";
    }

    return "all";
  }

  private toInstagramSearchResult(user: InstagramUserPayload): InstagramSearchResultItem {
    const id = String(user.pk ?? user.id ?? "");
    const username = user.username ?? id;
    return {
      id,
      username,
      fullName: user.full_name ?? undefined,
      url: `${INSTAGRAM_ORIGIN}/${username}/`,
      isPrivate: user.is_private,
      isVerified: user.is_verified,
      followerCount: user.follower_count ?? user.edge_followed_by?.count,
      profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url,
    };
  }

  private toInstagramProfileInfo(user: InstagramUserPayload, fallbackUrl?: string): InstagramProfileInfo {
    const id = String(user.pk ?? user.id ?? "");
    const username = user.username ?? undefined;
    return {
      id,
      username,
      fullName: user.full_name ?? undefined,
      biography: user.biography ?? undefined,
      url: username ? `${INSTAGRAM_ORIGIN}/${username}/` : fallbackUrl,
      externalUrl: user.external_url ?? undefined,
      isPrivate: user.is_private,
      isVerified: user.is_verified,
      followerCount: user.follower_count ?? user.edge_followed_by?.count,
      followingCount: user.following_count ?? user.edge_follow?.count,
      mediaCount: user.media_count ?? user.edge_owner_to_timeline_media?.count,
      profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url,
    };
  }

  private toInstagramMediaInfo(media: InstagramMediaPayload, fallbackUrl?: string): InstagramMediaInfo {
    const id = String(media.pk ?? media.id ?? "");
    const shortcode = media.code ?? undefined;
    return {
      id,
      shortcode,
      url: shortcode ? `${INSTAGRAM_ORIGIN}/p/${shortcode}/` : fallbackUrl,
      ownerUsername: media.user?.username ?? undefined,
      ownerUrl: media.user?.username ? `${INSTAGRAM_ORIGIN}/${media.user.username}/` : undefined,
      mediaType: this.describeInstagramMediaType(media),
      likeCount: media.like_count,
      commentCount: media.comment_count,
      playCount: media.play_count ?? media.view_count,
      caption: media.caption?.text ?? undefined,
      takenAt: this.toIsoTimestamp(media.taken_at),
      thumbnailUrl: media.image_versions2?.candidates?.[0]?.url ?? media.video_versions?.[0]?.url,
    };
  }

  private toInstagramPostSummary(media: InstagramMediaPayload): InstagramPostSummary {
    const info = this.toInstagramMediaInfo(media);
    return {
      id: info.id,
      shortcode: info.shortcode,
      url: info.url,
      mediaType: info.mediaType,
      likeCount: info.likeCount,
      commentCount: info.commentCount,
      playCount: info.playCount,
      caption: info.caption,
      takenAt: info.takenAt,
      thumbnailUrl: info.thumbnailUrl,
      ownerUsername: info.ownerUsername,
    };
  }

  private toInstagramStoryItem(media: InstagramMediaPayload): InstagramStoryItem {
    const info = this.toInstagramMediaInfo(media);
    const ownerUsername = media.user?.username ?? info.ownerUsername;
    const storyId = String(media.pk ?? media.id ?? "");
    return {
      id: storyId,
      url: ownerUsername ? `${INSTAGRAM_ORIGIN}/stories/${ownerUsername}/${storyId}/` : undefined,
      mediaType: info.mediaType,
      takenAt: info.takenAt,
      expiresAt: this.toIsoTimestamp(media.expiring_at),
      thumbnailUrl: info.thumbnailUrl,
      assetUrl: media.video_versions?.[0]?.url ?? media.image_versions2?.candidates?.[0]?.url,
    };
  }

  private matchesInstagramPostFilter(media: InstagramMediaPayload, type: InstagramPostFilter): boolean {
    if (type === "all") {
      return true;
    }

    return this.describeInstagramMediaType(media) === type;
  }

  private matchesInstagramStoryMediaFilter(
    media: InstagramMediaPayload,
    filter: "all" | "photo" | "video",
  ): boolean {
    if (filter === "all") {
      return true;
    }

    const hasVideo = Array.isArray(media.video_versions) && media.video_versions.length > 0;
    return filter === "video" ? hasVideo : !hasVideo;
  }

  private describeInstagramMediaType(media: InstagramMediaPayload): string | undefined {
    if (media.product_type === "clips") {
      return "reel";
    }

    switch (media.media_type) {
      case 1:
        return "photo";
      case 2:
        return "video";
      case 8:
        return "carousel";
      default:
        return media.product_type ?? undefined;
    }
  }

  private toIsoTimestamp(value?: number): string | undefined {
    if (!value || !Number.isFinite(value)) {
      return undefined;
    }

    return new Date(value * 1_000).toISOString();
  }

  private extractInstagramDownloadAssets(media: InstagramMediaPayload, all: boolean): InstagramDownloadAsset[] {
    const sources = Array.isArray(media.carousel_media) && media.carousel_media.length > 0 ? media.carousel_media : [media];
    const selected = all ? sources : sources.slice(0, 1);

    return selected
      .map((item, index) => {
        const videoUrl = item.video_versions?.[0]?.url;
        const imageUrl = item.image_versions2?.candidates?.[0]?.url;
        const url = videoUrl ?? imageUrl;
        if (!url) {
          return undefined;
        }

        return {
          url,
          extension: this.extensionFromUrl(url),
          mediaType: videoUrl ? "video" : "image",
          index,
        } satisfies InstagramDownloadAsset;
      })
      .filter((asset): asset is InstagramDownloadAsset => Boolean(asset));
  }

  private extensionFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      return match?.[1]?.toLowerCase() ?? "bin";
    } catch {
      return "bin";
    }
  }

  private normalizeInstagramDownloadExtension(extension: string, contentType?: string): string {
    if (extension && extension !== "bin") {
      return extension;
    }

    if (!contentType) {
      return "bin";
    }

    if (contentType.includes("video/mp4")) {
      return "mp4";
    }

    if (contentType.includes("image/jpeg")) {
      return "jpg";
    }

    if (contentType.includes("image/png")) {
      return "png";
    }

    return "bin";
  }

  private buildInstagramDownloadFilename(input: {
    info: InstagramMediaInfo;
    mediaType: string;
    index: number;
    extension: string;
    includeIndex: boolean;
  }): string {
    const owner = this.sanitizeFilename(input.info.ownerUsername ?? "instagram");
    const identity = this.sanitizeFilename(input.info.shortcode ?? input.info.id);
    const suffix = input.includeIndex ? `-${input.index + 1}` : "";
    return `${owner}-${identity}-${input.mediaType}${suffix}.${input.extension}`;
  }

  private buildInstagramStoryDownloadFilename(input: {
    profile: InstagramProfileInfo;
    storyId: string;
    mediaType: string;
    index: number;
    extension: string;
    includeIndex: boolean;
  }): string {
    const owner = this.sanitizeFilename(input.profile.username ?? input.profile.id);
    const identity = this.sanitizeFilename(input.storyId);
    const suffix = input.includeIndex ? `-${input.index + 1}` : "";
    return `${owner}-story-${identity}-${input.mediaType}${suffix}.${input.extension}`;
  }

  private sanitizeFilename(value: string): string {
    return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "media";
  }

  private async listFriendships(input: {
    account?: string;
    target: string;
    limit?: number;
    cursor?: string;
    kind: "followers" | "following";
  }): Promise<AdapterActionResult> {
    const { session } = await this.prepareSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createInstagramClient(session);
    const profile = await this.resolveInstagramProfileInfo(client, probe.metadata, input.target);
    const limit = this.normalizeSearchLimit(input.limit);

    const searchParams = new URLSearchParams({
      count: String(limit),
    });
    if (input.cursor) {
      searchParams.set("max_id", input.cursor);
    }

    const response = await client.request<InstagramFriendshipListResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/friendships/${encodeURIComponent(profile.id)}/${input.kind}/?${searchParams.toString()}`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, probe.metadata),
      },
    );

    const users = (response.users ?? []).slice(0, limit).map((user) => this.toInstagramSearchResult(user));
    const label = input.kind === "following" ? "following accounts" : "followers";

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: input.kind,
      message:
        users.length > 0
          ? `Loaded ${users.length} Instagram ${label} for ${profile.username ?? profile.id}.`
          : `No Instagram ${label} found for ${profile.username ?? profile.id}.`,
      id: profile.id,
      url: profile.url,
      user: probe.user,
      data: {
        profile: { ...profile },
        limit,
        cursor: input.cursor,
        nextCursor: response.next_max_id,
        hasMore: response.has_more,
        results: users.map((item) => ({ ...item })),
      },
    };
  }

  private async fetchInstagramStoryItems(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    profileId: string,
  ): Promise<InstagramMediaPayload[]> {
    const response = await client.request<InstagramStoryResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/feed/user/${encodeURIComponent(profileId)}/story/`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, metadata),
      },
    );

    return response.reel?.items ?? [];
  }

  private async resolveInstagramProfileInfo(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    target: string,
  ): Promise<InstagramProfileInfo> {
    const parsed = parseInstagramProfileTarget(target);
    const user = parsed.userId
      ? await this.fetchInstagramUserById(client, metadata, parsed.userId)
      : parsed.username
        ? await this.fetchInstagramUserByUsername(client, metadata, parsed.username)
        : undefined;

    if (!user) {
      throw new MikaCliError("INSTAGRAM_PROFILE_NOT_FOUND", "Instagram could not find that profile.", {
        details: {
          target,
        },
      });
    }

    return this.toInstagramProfileInfo(user, parsed.url);
  }

  private async fetchInstagramUserByUsername(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    username: string,
  ): Promise<InstagramUserPayload | undefined> {
    const response = await this.tryRequestChain<InstagramProfileInfoResponse | null>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, metadata),
          }),
      ],
      "",
      true,
    );

    return response?.data?.user ?? response?.user;
  }

  private async fetchInstagramUserById(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    userId: string,
  ): Promise<InstagramUserPayload | undefined> {
    const response = await this.tryRequestChain<InstagramProfileInfoResponse | null>(
      [
        async () =>
          client.request(`${INSTAGRAM_ORIGIN}/api/v1/users/${encodeURIComponent(userId)}/info/`, {
            expectedStatus: 200,
            headers: await this.buildInstagramHeaders(client, metadata),
          }),
      ],
      "",
      true,
    );

    return response?.data?.user ?? response?.user;
  }

  private async fetchInstagramMediaById(
    client: Awaited<ReturnType<InstagramAdapter["createInstagramClient"]>>,
    metadata: Record<string, unknown> | undefined,
    mediaId: string,
  ): Promise<InstagramMediaPayload> {
    const response = await client.request<InstagramMediaInfoResponse>(
      `${INSTAGRAM_ORIGIN}/api/v1/media/${encodeURIComponent(mediaId)}/info/`,
      {
        expectedStatus: 200,
        headers: await this.buildInstagramHeaders(client, metadata),
      },
    );

    const media = response.items?.[0];
    if (!media?.id && !media?.pk) {
      throw new MikaCliError("INSTAGRAM_MEDIA_NOT_FOUND", "Instagram could not find that media item.", {
        details: {
          mediaId,
        },
      });
    }

    return media;
  }

  private resolveInstagramPermalink(target: string): {
    mediaId: string;
    shortcode: string;
    url: string;
  } {
    const parsed = parseInstagramTarget(target);
    const shortcode = parsed.shortcode ?? instagramMediaIdToShortcode(parsed.mediaId);
    return {
      mediaId: parsed.mediaId,
      shortcode,
      url: parsed.url ?? `${INSTAGRAM_ORIGIN}/p/${shortcode}/`,
    };
  }

  private async ensureInstagramBrowserAuthenticated(page: PlaywrightPage): Promise<void> {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(750);

    const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    if (/use another profile/i.test(bodyText) && /\bcontinue\b/i.test(bodyText)) {
      const continueButton = await firstVisibleInstagramLocator(page, [
        'div[role="button"]:has-text("Continue")',
        'button:has-text("Continue")',
      ]).catch(() => undefined);
      if (continueButton) {
        await clickInstagramLocator(continueButton);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1_500);
      }
    }

    if (page.url().includes("/accounts/login")) {
      throw new MikaCliError(
        "INSTAGRAM_BROWSER_NOT_LOGGED_IN",
        "The browser session is not logged into Instagram. Re-login with `mikacli social instagram login --browser` first.",
      );
    }

    const loginInputs = await page.locator('input[name="username"], input[name="password"]').count().catch(() => 0);
    if (loginInputs > 0) {
      throw new MikaCliError(
        "INSTAGRAM_BROWSER_NOT_LOGGED_IN",
        "The browser session is not logged into Instagram. Re-login with `mikacli social instagram login --browser` first.",
      );
    }
  }

  private async waitForInstagramPostPage(page: PlaywrightPage, shortcode: string | undefined, targetUrl: string): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const url = page.url();
      if (!shortcode || url.includes(`/p/${shortcode}/`) || url.includes(`/reel/${shortcode}/`) || url.includes(`/tv/${shortcode}/`)) {
        const menuButton = await firstVisibleInstagramLocator(page, [
          '[aria-label="More options"]',
          'svg[aria-label="More options"]',
        ]).catch(() => undefined);
        if (menuButton) {
          return;
        }
      }

      await page.waitForTimeout(250);
    }

    throw new MikaCliError("INSTAGRAM_POST_NOT_FOUND", "Instagram never exposed the requested post in the browser flow.", {
      details: {
        targetUrl,
        shortcode,
        finalUrl: page.url(),
      },
    });
  }

  private async openInstagramPostActionMenu(page: PlaywrightPage): Promise<void> {
    const button = await firstVisibleInstagramLocator(page, [
      '[aria-label="More options"]',
      'button[aria-label="More options"]',
      'svg[aria-label="More options"]',
    ]);
    await clickInstagramLocator(button);
    await page.waitForTimeout(400);
  }

  private async waitForInstagramDeleteConfirmButton(page: PlaywrightPage): Promise<PlaywrightLocator> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const dialog = page.locator('div[role="dialog"]').last();
      if (await dialog.isVisible().catch(() => false)) {
        const button = await firstVisibleInstagramLocatorWithin(dialog, [
          'div[role="button"]:has-text("Delete")',
          'button:has-text("Delete")',
        ]).catch(() => undefined);
        if (button) {
          return button;
        }
      }

      await page.waitForTimeout(250);
    }

    throw new MikaCliError("INSTAGRAM_DELETE_CONFIRM_NOT_FOUND", "Instagram never exposed the delete confirmation button.", {
      details: {
        url: page.url(),
      },
    });
  }

  private async waitForInstagramPostRemoval(page: PlaywrightPage, targetUrl: string): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const currentUrl = page.url();
      const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      if (currentUrl !== targetUrl) {
        return;
      }

      if (/page isn't available|sorry, this page isn't available|content unavailable/i.test(bodyText)) {
        return;
      }

      await page.waitForTimeout(500);
    }

    throw new MikaCliError("INSTAGRAM_DELETE_TIMEOUT", "Instagram never confirmed that the post was deleted.", {
      details: {
        targetUrl,
        finalUrl: page.url(),
      },
    });
  }

  private async prepareSession(account?: string): Promise<{ session: PlatformSession; path: string }> {
    const loaded = await this.loadSession(account);
    return {
      path: loaded.path,
      session: await this.maybeAutoRefresh(loaded.session),
    };
  }

  private async maybeAutoRefresh(session: PlatformSession): Promise<PlatformSession> {
    const client = await this.createInstagramClient(session);
    const refresh = await maybeAutoRefreshSession({
      platform: this.platform,
      session,
      jar: client.jar,
      strategy: "homepage_keepalive",
      capability: "auto",
      refresh: async () => {
        await client.request<string>(INSTAGRAM_HOME, {
          responseType: "text",
          expectedStatus: 200,
          headers: {
            referer: INSTAGRAM_HOME,
          },
        });
      },
    });

    return this.persistExistingSession(session, {
      jar: client.jar,
      metadata: {
        ...(session.metadata ?? {}),
        ...refresh.metadata,
      },
    });
  }

  private async persistSessionState(session: PlatformSession, probe: InstagramProbe): Promise<void> {
    await this.persistExistingSession(session, {
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    });
  }

  private async tryRequestChain<T>(
    attempts: Array<() => Promise<T>>,
    fallbackMessage: string,
    allowNull = false,
  ): Promise<T> {
    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }

    if (allowNull) {
      return null as T;
    }

    throw new MikaCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: lastError,
      details: lastError instanceof Error ? { message: lastError.message } : undefined,
    });
  }
}

export function normalizeInstagramCommentId(commentId: string): string {
  const normalized = commentId.trim();
  if (!/^\d+$/u.test(normalized)) {
    throw new MikaCliError("INVALID_COMMENT_ID", "Expected a numeric Instagram comment ID.", {
      details: {
        commentId,
      },
    });
  }

  return normalized;
}

export function extractInstagramCommentId(response: InstagramCommentMutationResponse | null | undefined): string | undefined {
  const value = response?.id ?? response?.pk;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

async function firstVisibleInstagramLocator(page: PlaywrightPage, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  throw new MikaCliError("INSTAGRAM_BROWSER_ELEMENT_NOT_FOUND", `Could not find any visible Instagram element for selectors: ${selectors.join(", ")}`);
}

async function firstVisibleInstagramLocatorWithin(root: PlaywrightLocator, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = root.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  throw new MikaCliError("INSTAGRAM_BROWSER_ELEMENT_NOT_FOUND", `Could not find any visible Instagram element for selectors: ${selectors.join(", ")}`);
}

async function clickInstagramLocator(locator: PlaywrightLocator): Promise<void> {
  try {
    await locator.click({
      timeout: 5_000,
    });
    return;
  } catch {
    await locator.click({
      force: true,
      timeout: 5_000,
    });
  }
}
