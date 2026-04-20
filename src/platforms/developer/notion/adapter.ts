import { randomUUID } from "node:crypto";

import { CookieJar } from "tough-cookie";

import { sanitizeAccountName } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";
import { createSessionFile, CookieManager, serializeCookieJar } from "../../../utils/cookie-manager.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { NotionWebClient, type NotionWebBlock, type NotionWebCollection, type NotionWebCollectionView, type NotionWebComment, type NotionWebDiscussion, type NotionWebRecordMapShape, type NotionWebSpace, type NotionWebUser } from "./client.js";
import {
  buildNotionPageUrl,
  extractDataSourceTitle,
  extractNotionViewId,
  extractPageTitle,
  findCollectionTitlePropertyId,
  normalizeNotionId,
  plainTextFromSemanticString,
  sanitizeWorkspaceName,
  semanticParagraphsFromPlainText,
  semanticStringFromPlainText,
} from "./helpers.js";

import type { AdapterActionResult, AdapterStatusResult, LoginInput, Platform, PlatformSession, SessionStatus, SessionUser } from "../../../types.js";

type NotionSessionContext = {
  user: NotionWebUser;
  userId: string;
  space?: NotionWebSpace;
  spaceId?: string;
  recordMap: NotionWebRecordMapShape;
};

type ActiveNotionSession = {
  session: PlatformSession;
  path: string;
  jar: CookieJar;
  client: NotionWebClient;
  context: NotionSessionContext;
};

type ResolvedDatabaseTarget = {
  block?: NotionWebBlock;
  collection: NotionWebCollection;
  collectionId: string;
  view?: NotionWebCollectionView;
  viewId?: string;
};

type NotionOperation = Parameters<NotionWebClient["submitTransaction"]>[0][number];

export class NotionAdapter {
  readonly platform: Platform = "notion";
  readonly displayName = "Notion";

  private readonly cookieManager = new CookieManager();

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, {
      account: input.account,
      cookieFile: input.cookieFile,
      cookieString: input.cookieString,
      cookieJson: input.cookieJson,
      browser: input.browser,
      browserTimeoutSeconds: input.browserTimeoutSeconds,
      browserUrl: input.browserUrl,
    });

    const tokenV2 = await this.getCookieValue(imported.jar, "token_v2");
    if (!tokenV2) {
      throw new MikaCliError("NOTION_TOKEN_V2_MISSING", "Imported cookies did not include Notion's token_v2 cookie.");
    }

    const hintedUserId = await this.getCookieValue(imported.jar, "notion_user_id");
    const client = this.createWebClient(imported.jar, hintedUserId);
    const context = await client.getCurrentContext();
    const user = this.toSessionUser(context.user, context.space);
    const account = input.account ? sanitizeAccountName(input.account) : this.resolveAccountName(context.user, context.space);
    const status = this.activeStatus("Notion web session validated.");
    const metadata = this.buildMetadata(context, hintedUserId ?? context.userId);
    const session = createSessionFile({
      platform: this.platform,
      account,
      source: imported.source,
      user,
      status,
      metadata,
      cookieJar: serializeCookieJar(imported.jar),
    });
    const sessionPath = await this.cookieManager.saveSession(session);

    return this.buildResult({
      account: session.account,
      action: "login",
      message: `Saved Notion session for ${user.displayName ?? session.account}.`,
      sessionPath,
      user,
      data: {
        status: status.state,
        user: {
          ...user,
          email: context.user.email,
          workspaceName: context.space?.name,
        },
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    try {
      const active = await this.validateLoadedSession(session, path);
      return {
        platform: this.platform,
        account: active.session.account,
        sessionPath: path,
        connected: true,
        status: active.session.status.state,
        message: active.session.status.message,
        user: active.session.user,
        lastValidatedAt: active.session.status.lastValidatedAt,
      };
    } catch (error) {
      if (error instanceof MikaCliError && error.code === "NOTION_SESSION_INVALID") {
        const expired = await this.markSessionExpired(session, {
          path,
          message: error.message,
          lastErrorCode: error.code,
        });
        return {
          platform: this.platform,
          account: expired.account,
          sessionPath: path,
          connected: false,
          status: expired.status.state,
          message: expired.status.message,
          user: expired.user,
          lastValidatedAt: expired.status.lastValidatedAt,
        };
      }

      throw error;
    }
  }

  async me(): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    return this.buildResult({
      account: active.session.account,
      action: "me",
      message: "Loaded Notion web identity.",
      sessionPath: active.path,
      user: active.session.user,
      data: {
        user: {
          ...active.session.user,
          email: active.context.user.email,
          workspaceName: active.context.space?.name,
        },
      },
    });
  }

  async search(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const response = await active.client.search({
      query: input.query,
      limit: input.limit,
      spaceId: active.context.spaceId,
    });
    const items = this.collectSearchItems(response.recordMap, response.results, "all");
    await this.touchSession(active, "Notion search completed.");

    return this.buildResult({
      account: active.session.account,
      action: "search",
      message: `Loaded ${items.length} Notion result${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        query: input.query,
        items,
      },
    });
  }

  async pages(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const response = await active.client.search({
      query: input.query,
      limit: input.limit,
      spaceId: active.context.spaceId,
    });
    const items = this.collectSearchItems(response.recordMap, response.results, "page");
    await this.touchSession(active, "Notion pages loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "pages",
      message: `Loaded ${items.length} Notion page${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        query: input.query,
        items,
      },
    });
  }

  async page(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const pageId = normalizeNotionId(target);
    const response = await active.client.loadPage(pageId);
    const page = response.recordMap.block?.[pageId]?.value ?? (await active.client.getBlock(pageId));
    const collection = page.parent_table === "collection"
      ? response.recordMap.collection?.[page.parent_id]?.value ?? (await this.tryGetCollection(active.client, page.parent_id))
      : undefined;
    await this.touchSession(active, "Notion page loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "page",
      message: `Loaded Notion page ${extractPageTitle(page, { titlePropertyId: findCollectionTitlePropertyId(collection?.schema) })}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: page.id,
      url: buildNotionPageUrl(page.id),
      data: {
        page: this.summarizePage(page, collection),
      },
    });
  }

  async createPage(input: { parent: string; title: string; content?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new MikaCliError("NOTION_TITLE_REQUIRED", "Title cannot be empty.");
    }

    const resolvedParent = await this.resolveParent(active, input.parent);
    const pageId = randomUUID();
    const titlePropertyId = resolvedParent.kind === "database" ? resolvedParent.titlePropertyId : "title";
    const properties = {
      [titlePropertyId]: semanticStringFromPlainText(trimmedTitle),
    };

    const operations: NotionOperation[] = [
      active.client.createBlockRecord({
        id: pageId,
        parentId: resolvedParent.parentId,
        parentTable: resolvedParent.parentTable,
        spaceId: resolvedParent.spaceId,
        userId: active.context.userId,
        type: "page",
        properties,
      }),
    ];

    if (resolvedParent.kind === "page") {
      operations.push(
        active.client.addChildBlockOperation({
          parentId: resolvedParent.parentId,
          parentTable: resolvedParent.parentTable,
          blockId: pageId,
        }),
      );
    } else {
      for (const view of resolvedParent.views) {
        if (!view.alive || view.type === "calendar") {
          continue;
        }

        operations.push(
          active.client.setRecordPathOperation({
            id: view.id,
            table: "collection_view",
            path: ["page_sort"],
            args: [...(view.page_sort ?? []), pageId],
          }),
        );
      }
    }

    const lastChildId = await this.appendParagraphOperations({
      client: active.client,
      operations,
      parentPageId: pageId,
      userId: active.context.userId,
      spaceId: resolvedParent.spaceId,
      text: input.content,
    });

    operations.push(active.client.buildUpdateLastEditedOperation(active.context.userId, pageId));
    if (resolvedParent.kind === "page") {
      operations.push(active.client.buildUpdateLastEditedOperation(active.context.userId, resolvedParent.parentId));
    }
    if (lastChildId) {
      operations.push(active.client.buildUpdateLastEditedOperation(active.context.userId, lastChildId));
    }

    await active.client.submitTransaction(operations);
    const page = await active.client.getBlock(pageId);
    const collection = page.parent_table === "collection" ? await this.tryGetCollection(active.client, page.parent_id) : undefined;
    await this.touchSession(active, "Notion page created.");

    return this.buildResult({
      account: active.session.account,
      action: "create-page",
      message: `Created Notion page ${extractPageTitle(page, { titlePropertyId })}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: page.id,
      url: buildNotionPageUrl(page.id),
      data: {
        page: this.summarizePage(page, collection),
      },
    });
  }

  async updatePage(input: { target: string; title?: string; archive?: boolean }): Promise<AdapterActionResult> {
    if (!input.title && !input.archive) {
      throw new MikaCliError("NOTION_UPDATE_EMPTY", "Provide --title or --archive to update the page.");
    }

    const active = await this.ensureUsableSession();
    const pageId = normalizeNotionId(input.target);
    const page = await active.client.getBlock(pageId);
    const collection = page.parent_table === "collection" ? await this.tryGetCollection(active.client, page.parent_id) : undefined;
    const titlePropertyId = findCollectionTitlePropertyId(collection?.schema) ?? "title";
    const operations: NotionOperation[] = [];

    if (input.title) {
      operations.push(
        active.client.setRecordPathOperation({
          id: pageId,
          path: ["properties", titlePropertyId],
          args: semanticStringFromPlainText(input.title),
        }),
      );
    }

    if (input.archive) {
      operations.push(
        active.client.updateRecordOperation({
          id: pageId,
          args: {
            alive: false,
          },
        }),
      );

      if (page.parent_table === "block") {
        operations.push(
          active.client.removeChildBlockOperation({
            parentId: page.parent_id,
            parentTable: page.parent_table,
            blockId: pageId,
          }),
        );
      }
    }

    operations.push(active.client.buildUpdateLastEditedOperation(active.context.userId, pageId));
    if (page.parent_table === "block") {
      operations.push(active.client.buildUpdateLastEditedOperation(active.context.userId, page.parent_id));
    }

    await active.client.submitTransaction(operations);
    const nextPage = {
      ...page,
      alive: input.archive ? false : page.alive,
      properties: input.title ? { ...(page.properties ?? {}), [titlePropertyId]: semanticStringFromPlainText(input.title) } : page.properties,
      last_edited_time: Date.now(),
    };
    await this.touchSession(active, "Notion page updated.");

    return this.buildResult({
      account: active.session.account,
      action: "update-page",
      message: `Updated Notion page ${extractPageTitle(nextPage, { titlePropertyId })}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: nextPage.id,
      url: buildNotionPageUrl(nextPage.id),
      data: {
        page: this.summarizePage(nextPage, collection),
      },
    });
  }

  async append(input: { target: string; text: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const pageId = normalizeNotionId(input.target);
    const page = await active.client.getBlock(pageId);
    const trimmedText = input.text.trim();
    if (!trimmedText) {
      throw new MikaCliError("NOTION_APPEND_EMPTY", "Append text cannot be empty.");
    }

    const operations: NotionOperation[] = [];
    const appendedCount = await this.appendParagraphOperations({
      client: active.client,
      operations,
      parentPageId: pageId,
      userId: active.context.userId,
      spaceId: page.space_id ?? active.context.spaceId ?? this.requireSpaceId(active.context),
      text: trimmedText,
      after: page.content?.at(-1),
    });
    operations.push(active.client.buildUpdateLastEditedOperation(active.context.userId, pageId));
    await active.client.submitTransaction(operations);
    const nextPage = await active.client.getBlock(pageId);
    const collection = nextPage.parent_table === "collection" ? await this.tryGetCollection(active.client, nextPage.parent_id) : undefined;
    await this.touchSession(active, "Notion content appended.");

    return this.buildResult({
      account: active.session.account,
      action: "append",
      message: `Appended content to ${extractPageTitle(nextPage, { titlePropertyId: findCollectionTitlePropertyId(collection?.schema) })}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: nextPage.id,
      url: buildNotionPageUrl(nextPage.id),
      data: {
        page: this.summarizePage(nextPage, collection),
        appendedCount,
      },
    });
  }

  async dataSources(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const response = await active.client.search({
      query: input.query,
      limit: input.limit,
      spaceId: active.context.spaceId,
    });
    const items = this.collectSearchItems(response.recordMap, response.results, "database");
    await this.touchSession(active, "Notion data sources loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "databases",
      message: `Loaded ${items.length} Notion data source${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.session.user,
      data: {
        query: input.query,
        items,
      },
    });
  }

  async dataSource(target: string): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const resolved = await this.resolveDatabaseTarget(active, target, false);
    await this.touchSession(active, "Notion data source loaded.");

    return this.buildResult({
      account: active.session.account,
      action: "database",
      message: `Loaded Notion data source ${extractDataSourceTitle(resolved.collection)}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: resolved.collection.id,
      url: resolved.block ? buildNotionPageUrl(resolved.block.id) : buildNotionPageUrl(resolved.collection.id),
      data: {
        dataSource: this.summarizeDataSource(resolved.collection, resolved.block, resolved.view),
      },
    });
  }

  async queryDataSource(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const resolved = await this.resolveDatabaseTarget(active, input.target, true);
    if (!resolved.viewId) {
      throw new MikaCliError("NOTION_DATABASE_VIEW_REQUIRED", "This Notion database needs a view ID. Pass a full Notion database page URL or page ID instead of a raw collection ID.");
    }

    const response = await active.client.queryCollection({
      collectionId: resolved.collectionId,
      collectionViewId: resolved.viewId,
      spaceId: active.context.spaceId,
      userId: active.context.userId,
      limit: input.limit,
    });
    const reducer = response.result?.reducerResults?.collection_group_results;
    const blockIds = reducer && "blockIds" in reducer && Array.isArray(reducer.blockIds) ? reducer.blockIds : [];
    const items = blockIds
      .map((blockId) => response.recordMap.block?.[blockId]?.value)
      .filter((page): page is NotionWebBlock => Boolean(page))
      .map((page) => this.summarizePage(page, resolved.collection));
    await this.touchSession(active, "Notion data source queried.");

    return this.buildResult({
      account: active.session.account,
      action: "query",
      message: `Loaded ${items.length} page${items.length === 1 ? "" : "s"} from ${extractDataSourceTitle(resolved.collection)}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: resolved.collection.id,
      url: resolved.block ? buildNotionPageUrl(resolved.block.id) : buildNotionPageUrl(resolved.collection.id),
      data: {
        dataSource: this.summarizeDataSource(resolved.collection, resolved.block, resolved.view),
        items,
      },
    });
  }

  async comment(input: { target: string; text: string }): Promise<AdapterActionResult> {
    const active = await this.ensureUsableSession();
    const pageId = normalizeNotionId(input.target);
    const page = await active.client.getBlock(pageId);
    const trimmedText = input.text.trim();
    if (!trimmedText) {
      throw new MikaCliError("NOTION_COMMENT_EMPTY", "Comment text cannot be empty.");
    }

    const spaceId = page.space_id ?? active.context.spaceId ?? this.requireSpaceId(active.context);
    const discussionId = randomUUID();
    const commentId = randomUUID();
    const operations = [
      active.client.createDiscussionRecord({
        id: discussionId,
        pageId,
        spaceId,
        commentId,
      }),
      active.client.createCommentRecord({
        id: commentId,
        discussionId,
        spaceId,
        userId: active.context.userId,
        text: semanticStringFromPlainText(trimmedText),
      }),
      active.client.addChildBlockOperation({
        parentId: pageId,
        blockId: discussionId,
        childListKey: "discussions",
      }),
      active.client.buildUpdateLastEditedOperation(active.context.userId, pageId),
    ];

    await active.client.submitTransaction(operations);
    const comment: NotionWebComment = {
      id: commentId,
      alive: true,
      parent_id: discussionId,
      parent_table: "discussion",
      created_by_id: active.context.userId,
      created_time: Date.now(),
      last_edited_time: Date.now(),
      space_id: spaceId,
      text: semanticStringFromPlainText(trimmedText),
    };
    const discussion: NotionWebDiscussion = {
      id: discussionId,
      resolved: false,
      space_id: spaceId,
      parent_id: pageId,
      parent_table: "block",
      comments: [commentId],
      context: [[""]],
    };
    const nextPage = {
      ...page,
      discussions: [...(page.discussions ?? []), discussionId],
      last_edited_time: Date.now(),
    };
    const collection = nextPage.parent_table === "collection" ? await this.tryGetCollection(active.client, nextPage.parent_id) : undefined;
    await this.touchSession(active, "Notion comment created.");

    return this.buildResult({
      account: active.session.account,
      action: "comment",
      message: `Added a comment to ${extractPageTitle(nextPage, { titlePropertyId: findCollectionTitlePropertyId(collection?.schema) })}.`,
      sessionPath: active.path,
      user: active.session.user,
      id: comment.id,
      url: buildNotionPageUrl(nextPage.id),
      data: {
        page: this.summarizePage(nextPage, collection),
        comment: this.summarizeComment(comment, discussion),
      },
    });
  }

  private async ensureUsableSession(account?: string): Promise<ActiveNotionSession> {
    const { session, path } = await this.cookieManager.loadSession(this.platform, account);
    return this.validateLoadedSession(session, path);
  }

  private async validateLoadedSession(session: PlatformSession, path: string): Promise<ActiveNotionSession> {
    const jar = await this.cookieManager.createJar(session);
    const tokenV2 = await this.getCookieValue(jar, "token_v2");
    if (!tokenV2) {
      await this.markSessionExpired(session, {
        path,
        message: "Imported cookies did not include Notion's token_v2 cookie. Re-import fresh cookies.",
        lastErrorCode: "NOTION_TOKEN_V2_MISSING",
      });
      throw new MikaCliError("NOTION_SESSION_INVALID", "Imported cookies did not include Notion's token_v2 cookie. Re-import fresh cookies.");
    }

    const hintedUserId = this.sessionMetadataString(session, "notionUserId") ?? (await this.getCookieValue(jar, "notion_user_id"));
    const client = this.createWebClient(jar, hintedUserId);

    try {
      const context = await client.getCurrentContext();
      const user = this.toSessionUser(context.user, context.space);
      const status = this.activeStatus("Notion web session validated.");
      const metadata = this.buildMetadata(context, context.userId);
      const nextSession = await this.persistSession(session, jar, {
        user,
        status,
        metadata,
      });

      return {
        session: nextSession,
        path,
        jar,
        client: this.createWebClient(jar, context.userId),
        context,
      };
    } catch (error) {
      const expired = await this.markSessionExpired(session, {
        path,
        message: error instanceof MikaCliError ? error.message : "Notion rejected the saved web session. Re-import fresh cookies.",
        lastErrorCode: error instanceof MikaCliError ? error.code : "NOTION_SESSION_INVALID",
      });
      throw new MikaCliError("NOTION_SESSION_INVALID", expired.status.message ?? "Notion rejected the saved web session. Re-import fresh cookies.", {
        cause: error,
        details: {
          sessionPath: path,
          account: expired.account,
        },
      });
    }
  }

  private async persistSession(
    existingSession: PlatformSession,
    jar: CookieJar,
    input: {
      user?: SessionUser;
      status?: SessionStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PlatformSession> {
    const nextSession = createSessionFile({
      platform: this.platform,
      account: existingSession.account,
      source: existingSession.source,
      user: input.user ?? existingSession.user,
      status: input.status ?? existingSession.status,
      metadata: input.metadata ?? existingSession.metadata,
      cookieJar: serializeCookieJar(jar),
      existingSession,
    });
    await this.cookieManager.saveSession(nextSession);
    return nextSession;
  }

  private async markSessionExpired(
    session: PlatformSession,
    input: {
      path: string;
      message: string;
      lastErrorCode: string;
    },
  ): Promise<PlatformSession> {
    const jar = await this.cookieManager.createJar(session);
    return this.persistSession(session, jar, {
      status: {
        state: "expired",
        message: input.message,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: input.lastErrorCode,
      },
    });
  }

  private async touchSession(active: ActiveNotionSession, message: string): Promise<void> {
    const nextSession = await this.persistSession(active.session, active.jar, {
      status: this.activeStatus(message),
    });
    active.session = nextSession;
  }

  private createWebClient(jar: CookieJar, notionUserId?: string): NotionWebClient {
    return new NotionWebClient(new SessionHttpClient(jar), {
      activeUserId: notionUserId,
    });
  }

  private async resolveParent(
    active: ActiveNotionSession,
    target: string,
  ): Promise<
    | {
        kind: "page";
        parentId: string;
        parentTable: "block";
        spaceId: string;
      }
    | {
        kind: "database";
        parentId: string;
        parentTable: "collection";
        spaceId: string;
        titlePropertyId: string;
        views: NotionWebCollectionView[];
      }
  > {
    const pageId = normalizeNotionId(target);

    try {
      const block = await active.client.getBlock(pageId);
      if (block.type === "page") {
        return {
          kind: "page",
          parentId: block.id,
          parentTable: "block",
          spaceId: block.space_id ?? active.context.spaceId ?? this.requireSpaceId(active.context),
        };
      }

      if (block.type === "collection_view" || block.type === "collection_view_page") {
        const collection = await active.client.getCollection(block.collection_id ?? pageId);
        const titlePropertyId = findCollectionTitlePropertyId(collection.schema);
        if (!titlePropertyId) {
          throw new MikaCliError("NOTION_DATA_SOURCE_TITLE_MISSING", "Could not find a title property on the target Notion database.");
        }

        const views = await this.loadViews(active.client, block.view_ids ?? []);
        return {
          kind: "database",
          parentId: collection.id,
          parentTable: "collection",
          spaceId: block.space_id ?? active.context.spaceId ?? this.requireSpaceId(active.context),
          titlePropertyId,
          views,
        };
      }
    } catch (error) {
      if (!(error instanceof MikaCliError) || error.code !== "NOTION_NOT_FOUND") {
        throw error;
      }
    }

    const collection = await active.client.getCollection(pageId);
    const titlePropertyId = findCollectionTitlePropertyId(collection.schema);
    if (!titlePropertyId) {
      throw new MikaCliError("NOTION_DATA_SOURCE_TITLE_MISSING", "Could not find a title property on the target Notion database.");
    }

    return {
      kind: "database",
      parentId: collection.id,
      parentTable: "collection",
      spaceId: active.context.spaceId ?? this.requireSpaceId(active.context),
      titlePropertyId,
      views: [],
    };
  }

  private async resolveDatabaseTarget(active: ActiveNotionSession, target: string, requireView: boolean): Promise<ResolvedDatabaseTarget> {
    const id = normalizeNotionId(target);
    const explicitViewId = extractNotionViewId(target);

    try {
      const block = await active.client.getBlock(id);
      if (block.type !== "collection_view" && block.type !== "collection_view_page") {
        throw new MikaCliError("NOTION_DATABASE_INVALID", "That Notion page is not a database.");
      }

      const collection = await active.client.getCollection(block.collection_id ?? id);
      const viewId = explicitViewId ?? block.view_ids?.[0];
      const view = viewId ? await active.client.getCollectionView(viewId) : undefined;

      if (requireView && !viewId) {
        throw new MikaCliError("NOTION_DATABASE_VIEW_REQUIRED", "This Notion database needs a view ID. Pass a full Notion database page URL or page ID instead of a raw collection ID.");
      }

      return {
        block,
        collection,
        collectionId: collection.id,
        view,
        viewId,
      };
    } catch (error) {
      if (!(error instanceof MikaCliError) || error.code !== "NOTION_NOT_FOUND") {
        throw error;
      }
    }

    const collection = await active.client.getCollection(id);
    if (requireView && !explicitViewId) {
      throw new MikaCliError("NOTION_DATABASE_VIEW_REQUIRED", "This Notion database needs a view ID. Pass a full Notion database page URL or page ID instead of a raw collection ID.");
    }

    const view = explicitViewId ? await active.client.getCollectionView(explicitViewId) : undefined;
    return {
      collection,
      collectionId: collection.id,
      view,
      viewId: explicitViewId,
    };
  }

  private async loadViews(client: NotionWebClient, viewIds: string[]): Promise<NotionWebCollectionView[]> {
    const views: NotionWebCollectionView[] = [];
    for (const viewId of viewIds) {
      try {
        views.push(await client.getCollectionView(viewId));
      } catch (error) {
        if (!(error instanceof MikaCliError) || error.code !== "NOTION_NOT_FOUND") {
          throw error;
        }
      }
    }
    return views;
  }

  private async appendParagraphOperations(input: {
    client: NotionWebClient;
      operations: NotionOperation[];
    parentPageId: string;
    userId: string;
    spaceId: string;
    text?: string;
    after?: string;
  }): Promise<string | undefined> {
    if (!input.text?.trim()) {
      return input.after;
    }

    let previousId = input.after;
    for (const paragraph of semanticParagraphsFromPlainText(input.text)) {
      const blockId = randomUUID();
      input.operations.push(
        input.client.createBlockRecord({
          id: blockId,
          parentId: input.parentPageId,
          parentTable: "block",
          spaceId: input.spaceId,
          userId: input.userId,
          type: "text",
          properties: {
            title: paragraph,
          },
        }),
      );
      input.operations.push(
        input.client.addChildBlockOperation({
          parentId: input.parentPageId,
          parentTable: "block",
          blockId,
          after: previousId,
        }),
      );
      previousId = blockId;
    }

    return previousId;
  }

  private collectSearchItems(
    recordMap: NotionWebRecordMapShape,
    results: Array<{ id: string }>,
    kind: "all" | "page" | "database",
  ): Record<string, unknown>[] {
    const items: Record<string, unknown>[] = [];

    for (const result of results) {
      const block = recordMap.block?.[result.id]?.value;
      if (!block) {
        continue;
      }

      if (block.type === "page") {
        if (kind !== "database") {
          const collection = block.parent_table === "collection" ? recordMap.collection?.[block.parent_id]?.value : undefined;
          items.push(this.summarizePage(block, collection));
        }
        continue;
      }

      if (block.type === "collection_view" || block.type === "collection_view_page") {
        if (kind !== "page") {
          const collection = block.collection_id ? recordMap.collection?.[block.collection_id]?.value : undefined;
          const view = block.view_ids?.[0] ? recordMap.collection_view?.[block.view_ids[0]]?.value : undefined;
          if (collection) {
            items.push(this.summarizeDataSource(collection, block, view));
          }
        }
      }
    }

    return items;
  }

  private summarizePage(page: NotionWebBlock, collection?: NotionWebCollection): Record<string, unknown> {
    const titlePropertyId = findCollectionTitlePropertyId(collection?.schema);
    return {
      object: page.type,
      id: page.id,
      title: extractPageTitle(page, { titlePropertyId }),
      titleProperty: titlePropertyId ?? "title",
      url: buildNotionPageUrl(page.id),
      archived: !page.alive,
      inTrash: !page.alive,
      createdAt: this.toIsoTime(page.created_time),
      updatedAt: this.toIsoTime(page.last_edited_time),
      parent: {
        id: page.parent_id,
        table: page.parent_table,
      },
      propertyNames: collection
        ? Object.values(collection.schema).map((property) => property.name)
        : Object.keys(page.properties ?? {}),
      childCount: page.content?.length ?? 0,
    };
  }

  private summarizeDataSource(
    collection: NotionWebCollection,
    block?: NotionWebBlock,
    view?: NotionWebCollectionView,
  ): Record<string, unknown> {
    return {
      object: block?.type ?? "collection",
      id: collection.id,
      title: extractDataSourceTitle(collection),
      url: block ? buildNotionPageUrl(block.id) : buildNotionPageUrl(collection.id),
      archived: !collection.alive,
      inTrash: !collection.alive,
      updatedAt: undefined,
      propertyNames: Object.values(collection.schema).map((property) => property.name),
      description: plainTextFromSemanticString(collection.description),
      viewId: view?.id,
      viewType: view?.type,
    };
  }

  private summarizeComment(comment: NotionWebComment, discussion: NotionWebDiscussion): Record<string, unknown> {
    return {
      id: comment.id,
      discussionId: discussion.id,
      createdAt: this.toIsoTime(comment.created_time),
      updatedAt: this.toIsoTime(comment.last_edited_time),
      text: plainTextFromSemanticString(comment.text),
    };
  }

  private toSessionUser(user: NotionWebUser, space?: NotionWebSpace): SessionUser {
    const fullName = [user.given_name, user.family_name].filter(Boolean).join(" ").trim();
    const workspaceName = space?.name?.trim();
    const usernameSeed = workspaceName ?? user.email?.split("@")[0] ?? fullName ?? user.id;
    return {
      id: user.id,
      username: sanitizeWorkspaceName(usernameSeed),
      displayName: fullName || workspaceName || user.email || user.id,
      profileUrl: buildNotionPageUrl(user.id),
    };
  }

  private resolveAccountName(user: NotionWebUser, space?: NotionWebSpace): string {
    const workspaceName = space?.name?.trim();
    if (workspaceName) {
      return sanitizeWorkspaceName(workspaceName);
    }

    const emailLocal = user.email?.split("@")[0]?.trim();
    if (emailLocal) {
      return sanitizeWorkspaceName(emailLocal);
    }

    const fullName = [user.given_name, user.family_name].filter(Boolean).join(" ").trim();
    if (fullName) {
      return sanitizeWorkspaceName(fullName);
    }

    return sanitizeWorkspaceName(user.id);
  }

  private buildMetadata(context: NotionSessionContext, notionUserId: string): Record<string, unknown> {
    return {
      notionUserId,
      spaceId: context.spaceId,
      workspaceName: context.space?.name,
      workspaceDomain: context.space?.domain,
      email: context.user.email,
      authMode: "cookies",
    };
  }

  private buildResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath: string;
    user?: SessionUser;
    id?: string;
    url?: string;
    data?: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: input.account,
      action: input.action,
      message: input.message,
      sessionPath: input.sessionPath,
      user: input.user,
      ...(input.id ? { id: input.id } : {}),
      ...(input.url ? { url: input.url } : {}),
      ...(input.data ? { data: input.data } : {}),
    };
  }

  private activeStatus(message: string): SessionStatus {
    return {
      state: "active",
      message,
      lastValidatedAt: new Date().toISOString(),
    };
  }

  private async getCookieValue(jar: CookieJar, name: string): Promise<string | undefined> {
    const cookies = await jar.getCookies("https://www.notion.so/");
    return cookies.find((cookie) => cookie.key === name)?.value;
  }

  private sessionMetadataString(session: PlatformSession, key: string): string | undefined {
    const value = session.metadata?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private requireSpaceId(context: NotionSessionContext): string {
    if (!context.spaceId) {
      throw new MikaCliError("NOTION_SPACE_ID_MISSING", "Notion did not expose a workspace/space ID for this session.");
    }

    return context.spaceId;
  }

  private toIsoTime(timestamp: number | undefined): string | undefined {
    return typeof timestamp === "number" && Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
  }

  private async tryGetCollection(client: NotionWebClient, collectionId: string): Promise<NotionWebCollection | undefined> {
    try {
      return await client.getCollection(collectionId);
    } catch (error) {
      if (error instanceof MikaCliError && error.code === "NOTION_NOT_FOUND") {
        return undefined;
      }
      throw error;
    }
  }
}

export const notionAdapter = new NotionAdapter();
