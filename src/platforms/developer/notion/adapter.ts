import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";
import {
  buildParagraphBlocks,
  extractDataSourceTitle,
  extractPageTitle,
  findTitlePropertyName,
  normalizeNotionId,
  plainTextFromRichText,
  richTextFromPlainText,
} from "./helpers.js";
import { NotionApiClient, type NotionComment, type NotionDataSource, type NotionPage, type NotionSearchItem, type NotionUser } from "./client.js";

type NotionLoadedConnection = Awaited<ReturnType<ConnectionStore["loadApiKeyConnection"]>>;

export class NotionAdapter {
  readonly platform: Platform = "notion";
  readonly displayName = "Notion";

  private readonly connectionStore = new ConnectionStore();

  async loginWithToken(input: { token: string }): Promise<AdapterActionResult> {
    const token = normalizeNotionToken(input.token);
    const client = new NotionApiClient({ token });
    const me = await client.getSelf();
    const user = this.toSessionUser(me);
    const account = this.resolveAccountName(me);
    const status = this.activeStatus("Notion integration token validated.");
    const sessionPath = await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account,
      provider: "notion",
      token,
      user,
      status,
      metadata: {
        workspaceName: this.getWorkspaceName(me),
        type: me.type,
      },
    });

    return this.buildResult({
      account,
      action: "login",
      message: `Saved Notion token for ${user.displayName ?? account}.`,
      sessionPath,
      user,
      data: {
        user: {
          ...user,
          workspaceName: this.getWorkspaceName(me),
          type: me.type,
        },
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account);
    const client = this.createClient(loaded.auth.token);
    const me = await client.getSelf();
    const user = this.toSessionUser(me);
    const status = this.activeStatus("Notion token validated.");
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "notion",
      token: loaded.auth.token,
      user,
      status,
      metadata: {
        ...(loaded.connection.metadata ?? {}),
        workspaceName: this.getWorkspaceName(me),
        type: me.type,
      },
    });

    return {
      platform: this.platform,
      account: loaded.connection.account,
      sessionPath: loaded.path,
      connected: true,
      status: "active",
      message: status.message,
      user,
      lastValidatedAt: status.lastValidatedAt,
    };
  }

  async me(): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const me = await client.getSelf();
    const user = this.toSessionUser(me);
    await this.touchConnection(loaded, user, "Notion token validated.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "me",
      message: "Loaded Notion integration identity.",
      sessionPath: loaded.path,
      user,
      data: {
        user: {
          ...user,
          workspaceName: this.getWorkspaceName(me),
          type: me.type,
          email: me.person?.email,
        },
      },
    });
  }

  async search(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const response = await client.search({
      query: input.query,
      limit: input.limit,
    });
    await this.touchConnection(loaded, loaded.connection.user, "Notion search completed.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "search",
      message: `Loaded ${response.results.length} Notion result${response.results.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        query: input.query,
        nextCursor: response.next_cursor,
        hasMore: response.has_more,
        items: response.results.map((item) => this.summarizeSearchItem(item)),
      },
    });
  }

  async pages(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const response = await client.search({
      query: input.query,
      object: "page",
      limit: input.limit,
    });
    await this.touchConnection(loaded, loaded.connection.user, "Notion pages loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "pages",
      message: `Loaded ${response.results.length} Notion page${response.results.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        query: input.query,
        nextCursor: response.next_cursor,
        hasMore: response.has_more,
        items: response.results.map((item) => this.summarizeSearchItem(item)),
      },
    });
  }

  async page(target: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const pageId = normalizeNotionId(target);
    const page = await client.getPage(pageId);
    await this.touchConnection(loaded, loaded.connection.user, "Notion page loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "page",
      message: `Loaded Notion page ${extractPageTitle(page)}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: page.id,
      url: page.url,
      data: {
        page: this.summarizePage(page),
      },
    });
  }

  async createPage(input: { parent: string; title: string; content?: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const parentId = normalizeNotionId(input.parent);
    const trimmedTitle = input.title.trim();
    if (trimmedTitle.length === 0) {
      throw new AutoCliError("NOTION_TITLE_REQUIRED", "Title cannot be empty.");
    }

    const resolvedParent = await this.resolveParent(client, parentId);
    const page = await client.createPage({
      parent: resolvedParent.parent,
      properties: {
        [resolvedParent.titlePropertyName]: {
          title: richTextFromPlainText(trimmedTitle),
        },
      },
      children: input.content ? buildParagraphBlocks(input.content.trim()) : undefined,
    });
    await this.touchConnection(loaded, loaded.connection.user, "Notion page created.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "create-page",
      message: `Created Notion page ${extractPageTitle(page)}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: page.id,
      url: page.url,
      data: {
        page: this.summarizePage(page),
      },
    });
  }

  async updatePage(input: { target: string; title?: string; archive?: boolean }): Promise<AdapterActionResult> {
    if (!input.title && !input.archive) {
      throw new AutoCliError("NOTION_UPDATE_EMPTY", "Provide --title or --archive to update the page.");
    }

    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const pageId = normalizeNotionId(input.target);
    const existing = await client.getPage(pageId);

    let properties: Record<string, unknown> | undefined;
    if (input.title) {
      const titlePropertyName = findTitlePropertyName(existing.properties);
      if (!titlePropertyName) {
        throw new AutoCliError("NOTION_TITLE_PROPERTY_MISSING", "Could not find a title property on this page.");
      }
      properties = {
        [titlePropertyName]: {
          title: richTextFromPlainText(input.title.trim()),
        },
      };
    }

    const page = await client.updatePage({
      pageId,
      properties,
      archived: input.archive ? true : undefined,
      inTrash: input.archive ? true : undefined,
    });
    await this.touchConnection(loaded, loaded.connection.user, "Notion page updated.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "update-page",
      message: `Updated Notion page ${extractPageTitle(page)}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: page.id,
      url: page.url,
      data: {
        page: this.summarizePage(page),
      },
    });
  }

  async append(input: { target: string; text: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const pageId = normalizeNotionId(input.target);
    const trimmedText = input.text.trim();
    if (trimmedText.length === 0) {
      throw new AutoCliError("NOTION_APPEND_EMPTY", "Append text cannot be empty.");
    }

    const appended = await client.appendBlockChildren(pageId, buildParagraphBlocks(trimmedText));
    const page = await client.getPage(pageId);
    await this.touchConnection(loaded, loaded.connection.user, "Notion content appended.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "append",
      message: `Appended content to ${extractPageTitle(page)}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: page.id,
      url: page.url,
      data: {
        page: this.summarizePage(page),
        appendedCount: appended.results.length,
      },
    });
  }

  async dataSources(input: { query?: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const response = await client.search({
      query: input.query,
      object: "data_source",
      limit: input.limit,
    });
    await this.touchConnection(loaded, loaded.connection.user, "Notion data sources loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "databases",
      message: `Loaded ${response.results.length} Notion data source${response.results.length === 1 ? "" : "s"}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      data: {
        query: input.query,
        nextCursor: response.next_cursor,
        hasMore: response.has_more,
        items: response.results.map((item) => this.summarizeSearchItem(item)),
      },
    });
  }

  async dataSource(target: string): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const dataSourceId = normalizeNotionId(target);
    const dataSource = await client.getDataSource(dataSourceId);
    await this.touchConnection(loaded, loaded.connection.user, "Notion data source loaded.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "database",
      message: `Loaded Notion data source ${extractDataSourceTitle(dataSource)}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: dataSource.id,
      url: dataSource.url,
      data: {
        dataSource: this.summarizeDataSource(dataSource),
      },
    });
  }

  async queryDataSource(input: { target: string; limit?: number }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const dataSourceId = normalizeNotionId(input.target);
    const response = await client.queryDataSource({
      dataSourceId,
      limit: input.limit,
    });
    const dataSource = await client.getDataSource(dataSourceId);
    await this.touchConnection(loaded, loaded.connection.user, "Notion data source queried.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "query",
      message: `Loaded ${response.results.length} page${response.results.length === 1 ? "" : "s"} from ${extractDataSourceTitle(dataSource)}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: dataSource.id,
      url: dataSource.url,
      data: {
        dataSource: this.summarizeDataSource(dataSource),
        nextCursor: response.next_cursor,
        hasMore: response.has_more,
        items: response.results.map((page) => this.summarizePage(page)),
      },
    });
  }

  async comment(input: { target: string; text: string }): Promise<AdapterActionResult> {
    const loaded = await this.loadConnection();
    const client = this.createClient(loaded.auth.token);
    const pageId = normalizeNotionId(input.target);
    const trimmedText = input.text.trim();
    if (trimmedText.length === 0) {
      throw new AutoCliError("NOTION_COMMENT_EMPTY", "Comment text cannot be empty.");
    }

    const comment = await client.createComment({
      pageId,
      richText: richTextFromPlainText(trimmedText),
    });
    const page = await client.getPage(pageId);
    await this.touchConnection(loaded, loaded.connection.user, "Notion comment created.");

    return this.buildResult({
      account: loaded.connection.account,
      action: "comment",
      message: `Added a comment to ${extractPageTitle(page)}.`,
      sessionPath: loaded.path,
      user: loaded.connection.user,
      id: comment.id,
      url: page.url,
      data: {
        page: this.summarizePage(page),
        comment: this.summarizeComment(comment),
      },
    });
  }

  private createClient(token: string): NotionApiClient {
    return new NotionApiClient({ token });
  }

  private async loadConnection(account?: string): Promise<NotionLoadedConnection> {
    const loaded = await this.connectionStore.loadApiKeyConnection(this.platform, account);
    if (!loaded.auth.token) {
      throw new AutoCliError("NOTION_TOKEN_MISSING", "The saved Notion connection is missing its token.", {
        details: {
          account: loaded.connection.account,
          connectionPath: loaded.path,
        },
      });
    }
    return loaded;
  }

  private async touchConnection(loaded: NotionLoadedConnection, user: SessionUser | undefined, message: string): Promise<void> {
    await this.connectionStore.saveApiKeyConnection({
      platform: this.platform,
      account: loaded.connection.account,
      provider: loaded.auth.provider ?? "notion",
      token: loaded.auth.token,
      user,
      status: this.activeStatus(message),
      metadata: loaded.connection.metadata,
    });
  }

  private async resolveParent(client: NotionApiClient, parentId: string): Promise<{
    parent: { page_id?: string; data_source_id?: string };
    titlePropertyName: string;
  }> {
    try {
      const parentPage = await client.getPage(parentId);
      const titlePropertyName = findTitlePropertyName(parentPage.properties) ?? "title";
      return {
        parent: { page_id: parentPage.id },
        titlePropertyName,
      };
    } catch (error) {
      if (!(error instanceof AutoCliError) || error.code !== "NOTION_NOT_FOUND") {
        throw error;
      }
    }

    const parentDataSource = await client.getDataSource(parentId);
    const titlePropertyName = findTitlePropertyName(parentDataSource.properties);
    if (!titlePropertyName) {
      throw new AutoCliError("NOTION_DATA_SOURCE_TITLE_MISSING", "Could not find a title property on the target Notion data source.", {
        details: {
          dataSourceId: parentDataSource.id,
        },
      });
    }

    return {
      parent: { data_source_id: parentDataSource.id },
      titlePropertyName,
    };
  }

  private summarizeSearchItem(item: NotionSearchItem): Record<string, unknown> {
    if (item.object === "page") {
      return this.summarizePage(item);
    }

    return this.summarizeDataSource(item);
  }

  private summarizePage(page: NotionPage): Record<string, unknown> {
    const titlePropertyName = findTitlePropertyName(page.properties);
    return {
      object: page.object,
      id: page.id,
      title: extractPageTitle(page),
      titleProperty: titlePropertyName,
      url: page.url,
      archived: page.archived,
      inTrash: page.in_trash,
      createdAt: page.created_time,
      updatedAt: page.last_edited_time,
      parent: page.parent,
      propertyNames: Object.keys(page.properties ?? {}),
    };
  }

  private summarizeDataSource(dataSource: NotionDataSource): Record<string, unknown> {
    return {
      object: dataSource.object,
      id: dataSource.id,
      title: extractDataSourceTitle(dataSource),
      url: dataSource.url,
      archived: dataSource.archived,
      inTrash: dataSource.in_trash,
      createdAt: dataSource.created_time,
      updatedAt: dataSource.last_edited_time,
      propertyNames: Object.keys(dataSource.properties ?? {}),
      description: plainTextFromRichText(dataSource.description),
    };
  }

  private summarizeComment(comment: NotionComment): Record<string, unknown> {
    return {
      id: comment.id,
      discussionId: comment.discussion_id,
      createdAt: comment.created_time,
      updatedAt: comment.last_edited_time,
      text: plainTextFromRichText(comment.rich_text),
    };
  }

  private toSessionUser(me: NotionUser): SessionUser {
    const workspaceName = this.getWorkspaceName(me);
    const displayName = me.name ?? workspaceName ?? me.id;
    return {
      id: me.id,
      username: workspaceName ? sanitizeWorkspaceName(workspaceName) : undefined,
      displayName,
    };
  }

  private getWorkspaceName(me: NotionUser): string | undefined {
    const botWorkspaceName = me.bot?.workspace_name?.trim();
    if (botWorkspaceName) {
      return botWorkspaceName;
    }

    const ownerName = me.bot?.owner?.user?.name?.trim();
    if (ownerName) {
      return ownerName;
    }

    const userName = me.name?.trim();
    if (userName) {
      return userName;
    }

    return undefined;
  }

  private resolveAccountName(me: NotionUser): string {
    return sanitizeWorkspaceName(this.getWorkspaceName(me) ?? me.id ?? "default");
  }

  private activeStatus(message: string): SessionStatus {
    return {
      state: "active",
      message,
      lastValidatedAt: new Date().toISOString(),
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
}

export const notionAdapter = new NotionAdapter();

function normalizeNotionToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new AutoCliError("NOTION_TOKEN_INVALID", "Notion token cannot be empty.");
  }

  return trimmed;
}

function sanitizeWorkspaceName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "default";
}

