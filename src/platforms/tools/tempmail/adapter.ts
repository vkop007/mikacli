import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { getConnectionPath, sanitizeAccountName } from "../../../config.js";
import { ConnectionStore } from "../../../core/auth/connection-store.js";
import { AutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";

import type { ConnectionRecord } from "../../../core/auth/auth-types.js";
import type { AdapterActionResult, AdapterStatusResult, Platform, SessionStatus, SessionUser } from "../../../types.js";

const MAIL_TM_API_BASE_URL = "https://api.mail.tm";
const MAIL_TM_HOME_URL = "https://mail.tm/";
const MAIL_TM_DOCS_URL = "https://docs.mail.tm/";
const DEFAULT_INBOX_LIMIT = 20;
const MAX_INBOX_LIMIT = 100;
const DEFAULT_WAIT_TIMEOUT_MS = 2 * 60 * 1000;
const DEFAULT_WAIT_INTERVAL_MS = 3 * 1000;

type HydraCollection<T> = {
  "hydra:member"?: T[];
  "hydra:totalItems"?: number;
};

type TempMailDomain = {
  id: string;
  domain: string;
  isActive: boolean;
  isPrivate: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type TempMailMailbox = {
  id: string;
  address: string;
  quota?: number;
  used?: number;
  isDisabled?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type TempMailMailboxSummary = {
  id: string;
  address: string;
  domain?: string;
  quota?: number;
  used?: number;
  usagePercent?: number;
  isDisabled?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  providerUrl: string;
  docsUrl: string;
};

type TempMailAddress = {
  name?: string;
  address?: string;
};

type TempMailMessage = {
  id: string;
  accountId?: string;
  msgid?: string;
  from?: TempMailAddress;
  to?: TempMailAddress[];
  subject?: string;
  intro?: string;
  text?: string;
  html?: string[];
  seen?: boolean;
  flagged?: boolean;
  isDeleted?: boolean;
  hasAttachments?: boolean;
  attachments?: TempMailAttachment[];
  size?: number;
  downloadUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TempMailAttachment = {
  id: string;
  filename?: string;
  contentType?: string;
  disposition?: string;
  transferEncoding?: string;
  related?: boolean;
  size?: number;
  downloadUrl?: string;
};

type TempMailMessageSummary = {
  id: string;
  subject: string;
  intro?: string;
  fromName?: string;
  fromAddress?: string;
  to?: string[];
  seen?: boolean;
  hasAttachments?: boolean;
  attachmentCount?: number;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  downloadUrl?: string;
  verificationCodes?: string[];
};

type TempMailMessageDetail = TempMailMessageSummary & {
  text?: string;
  html?: string[];
  links?: string[];
  attachments?: Array<{
    id: string;
    filename?: string;
    contentType?: string;
    size?: number;
    downloadUrl?: string;
  }>;
};

type TempMailTokenResponse = {
  id?: string;
  token?: string;
};

type TempMailSessionMetadata = {
  address: string;
  password: string;
  accountId: string;
  domain: string;
  providerUrl: string;
  docsUrl: string;
};

type LoadedTempMailConnection = {
  account: string;
  path: string;
  connection: ConnectionRecord;
  metadata: TempMailSessionMetadata;
};

type AuthenticatedTempMailConnection = LoadedTempMailConnection & {
  token: string;
  mailbox: TempMailMailbox;
  user: SessionUser;
};

export class TempMailAdapter {
  readonly platform: Platform = "tempmail" as Platform;
  readonly displayName = "Temp Mail";

  private readonly connectionStore = new ConnectionStore();

  async domains(): Promise<AdapterActionResult> {
    const domains = await this.listDomains();
    const items = domains.map((domain) => summarizeDomain(domain));

    return this.buildResult({
      account: "public",
      action: "domains",
      message: `Loaded ${items.length} temp-mail domain${items.length === 1 ? "" : "s"}.`,
      data: {
        domains: items,
        items,
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  async create(input: {
    account?: string;
    name?: string;
    domain?: string;
    password?: string;
  }): Promise<AdapterActionResult> {
    return this.createMailbox({
      action: "create",
      account: input.account,
      name: input.name,
      domain: input.domain,
      password: input.password,
    });
  }

  async login(input: {
    account?: string;
    address?: string;
    password?: string;
    name?: string;
    domain?: string;
  }): Promise<AdapterActionResult> {
    const address = normalizeOptionalString(input.address);
    if (!address) {
      return this.createMailbox({
        action: "login",
        account: input.account,
        name: input.name,
        domain: input.domain,
        password: input.password,
      });
    }

    const password = requireTempMailPassword(input.password, "Temp Mail login requires --password when using --address.");
    const token = await this.issueToken(address, password);
    const mailbox = await this.fetchMe(token);
    const savedAccount = resolveSavedTempMailAccountName(input.account, mailbox.address);
    const metadata: TempMailSessionMetadata = {
      address: mailbox.address,
      password,
      accountId: mailbox.id,
      domain: mailbox.address.split("@")[1] ?? "",
      providerUrl: MAIL_TM_HOME_URL,
      docsUrl: MAIL_TM_DOCS_URL,
    };
    const user = toTempMailUser(mailbox);
    const status = this.activeStatus(`Temp mailbox ${mailbox.address} is ready.`);
    const sessionPath = await this.connectionStore.saveSessionConnection({
      platform: this.platform,
      account: savedAccount,
      provider: "mail.tm",
      user,
      status,
      metadata,
    });

    return this.buildResult({
      account: savedAccount,
      action: "login",
      message: `Saved temp mailbox ${mailbox.address}.`,
      sessionPath,
      user,
      data: {
        status: status.state,
        mailbox: summarizeMailbox(mailbox),
        entity: summarizeMailbox(mailbox),
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const loaded = await this.loadConnection(account);

    try {
      const token = await this.issueToken(loaded.metadata.address, loaded.metadata.password);
      const mailbox = await this.fetchMe(token);
      const status = this.activeStatus(`Temp mailbox ${mailbox.address} is ready.`);
      await this.persistConnection(loaded, {
        mailbox,
        status,
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath: loaded.path,
        status,
        user: toTempMailUser(mailbox),
      });
    } catch (error) {
      const status = this.expiredStatus("Temp mailbox could not be validated. It may have expired or been deleted.", "TEMPMAIL_UNAVAILABLE");
      await this.connectionStore.saveSessionConnection({
        platform: this.platform,
        account: loaded.account,
        provider: "mail.tm",
        user: loaded.connection.user,
        status,
        metadata: loaded.metadata,
      });

      return this.buildStatusResult({
        account: loaded.account,
        sessionPath: loaded.path,
        status,
        user: loaded.connection.user,
      });
    }
  }

  async me(account?: string): Promise<AdapterActionResult> {
    const active = await this.loadAuthenticatedConnection(account);
    const mailbox = summarizeMailbox(active.mailbox);

    return this.buildResult({
      account: active.account,
      action: "me",
      message: `Loaded temp mailbox ${active.mailbox.address}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        mailbox,
        entity: mailbox,
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  async inbox(input: {
    account?: string;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const active = await this.loadAuthenticatedConnection(input.account);
    const limit = normalizeInboxLimit(input.limit, DEFAULT_INBOX_LIMIT);
    const messages = await this.listMessages(active.token, limit);
    const items = messages.map((message) => summarizeMessage(message));

    return this.buildResult({
      account: active.account,
      action: "inbox",
      message: `Loaded ${items.length} temp mail message${items.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        mailbox: summarizeMailbox(active.mailbox),
        messages: items,
        items,
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  async message(input: {
    account?: string;
    id: string;
    markRead?: boolean;
  }): Promise<AdapterActionResult> {
    const active = await this.loadAuthenticatedConnection(input.account);
    const detail = await this.getMessage(active.token, input.id);

    if (input.markRead && detail.seen !== true) {
      await this.markMessageRead(active.token, detail.id);
      detail.seen = true;
    }

    const message = summarizeMessageDetail(detail);

    return this.buildResult({
      account: active.account,
      action: "message",
      message: `Loaded temp mail message ${detail.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: detail.id,
      data: {
        mailbox: summarizeMailbox(active.mailbox),
        message,
        entity: message,
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  async wait(input: {
    account?: string;
    timeoutMs?: number;
    intervalMs?: number;
    limit?: number;
  }): Promise<AdapterActionResult> {
    const active = await this.loadAuthenticatedConnection(input.account);
    const timeoutMs = normalizePositiveInteger(input.timeoutMs, DEFAULT_WAIT_TIMEOUT_MS);
    const intervalMs = normalizePositiveInteger(input.intervalMs, DEFAULT_WAIT_INTERVAL_MS);
    const limit = normalizeInboxLimit(input.limit, DEFAULT_INBOX_LIMIT);
    const startedAt = Date.now();
    const knownIds = new Set((await this.listMessages(active.token, limit)).map((message) => message.id));

    while (Date.now() - startedAt <= timeoutMs) {
      await delay(intervalMs);
      const messages = await this.listMessages(active.token, limit);
      const incoming = messages.find((message) => !knownIds.has(message.id));

      if (!incoming) {
        for (const message of messages) {
          knownIds.add(message.id);
        }
        continue;
      }

      const detail = await this.getMessage(active.token, incoming.id);
      const message = summarizeMessageDetail(detail);

      return this.buildResult({
        account: active.account,
        action: "wait",
        message: `Received a new temp mail message${message.subject ? `: ${message.subject}` : "."}`,
        sessionPath: active.path,
        user: active.user,
        id: detail.id,
        data: {
          mailbox: summarizeMailbox(active.mailbox),
          message,
          entity: message,
          source: MAIL_TM_HOME_URL,
          docs: MAIL_TM_DOCS_URL,
        },
      });
    }

    throw new AutoCliError(
      "TEMPMAIL_WAIT_TIMEOUT",
      `No new temp mail message arrived within ${Math.ceil(timeoutMs / 1000)} seconds.`,
      {
        details: {
          platform: this.platform,
          account: active.account,
        },
      },
    );
  }

  async markRead(input: {
    account?: string;
    id: string;
  }): Promise<AdapterActionResult> {
    const active = await this.loadAuthenticatedConnection(input.account);
    await this.markMessageRead(active.token, input.id);

    return this.buildResult({
      account: active.account,
      action: "mark-read",
      message: `Marked temp mail message ${input.id} as read.`,
      sessionPath: active.path,
      user: active.user,
      id: input.id,
      data: {
        mailbox: summarizeMailbox(active.mailbox),
        message: {
          id: input.id,
          seen: true,
        },
        entity: {
          id: input.id,
          seen: true,
        },
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  async deleteMessage(input: {
    account?: string;
    id: string;
  }): Promise<AdapterActionResult> {
    const active = await this.loadAuthenticatedConnection(input.account);
    await this.deleteRemoteMessage(active.token, input.id);

    return this.buildResult({
      account: active.account,
      action: "delete-message",
      message: `Deleted temp mail message ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: input.id,
      data: {
        mailbox: summarizeMailbox(active.mailbox),
        message: {
          id: input.id,
          deleted: true,
        },
        entity: {
          id: input.id,
          deleted: true,
        },
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  async deleteInbox(account?: string): Promise<AdapterActionResult> {
    const active = await this.loadAuthenticatedConnection(account);
    await this.deleteRemoteAccount(active.token, active.mailbox.id);
    await rm(getConnectionPath(this.platform, active.account), { force: true });

    return this.buildResult({
      account: active.account,
      action: "delete-inbox",
      message: `Deleted temp mailbox ${active.mailbox.address}.`,
      user: active.user,
      data: {
        mailbox: summarizeMailbox(active.mailbox),
        entity: summarizeMailbox(active.mailbox),
        deleted: true,
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  private async createMailbox(input: {
    action: "create" | "login";
    account?: string;
    name?: string;
    domain?: string;
    password?: string;
  }): Promise<AdapterActionResult> {
    const domains = await this.listDomains();
    const domain = pickTempMailDomain(domains, input.domain);
    const localPart = normalizeTempMailLocalPart(input.name ?? createRandomTempMailLocalPart());
    const address = buildTempMailAddress(localPart, domain.domain);
    const password = normalizeOptionalString(input.password) ?? createRandomTempMailPassword();

    await this.createRemoteAccount(address, password);
    const token = await this.issueToken(address, password);
    const mailbox = await this.fetchMe(token);
    const savedAccount = resolveSavedTempMailAccountName(input.account, mailbox.address);
    const user = toTempMailUser(mailbox);
    const status = this.activeStatus(`Temp mailbox ${mailbox.address} is ready.`);
    const sessionPath = await this.connectionStore.saveSessionConnection({
      platform: this.platform,
      account: savedAccount,
      provider: "mail.tm",
      user,
      status,
      metadata: {
        address: mailbox.address,
        password,
        accountId: mailbox.id,
        domain: mailbox.address.split("@")[1] ?? domain.domain,
        providerUrl: MAIL_TM_HOME_URL,
        docsUrl: MAIL_TM_DOCS_URL,
      } satisfies TempMailSessionMetadata,
    });

    return this.buildResult({
      account: savedAccount,
      action: input.action,
      message: `${input.action === "create" ? "Created" : "Saved"} temp mailbox ${mailbox.address}.`,
      sessionPath,
      user,
      data: {
        status: status.state,
        mailbox: summarizeMailbox(mailbox),
        entity: summarizeMailbox(mailbox),
        source: MAIL_TM_HOME_URL,
        docs: MAIL_TM_DOCS_URL,
      },
    });
  }

  private async loadAuthenticatedConnection(account?: string): Promise<AuthenticatedTempMailConnection> {
    const loaded = await this.loadConnection(account);
    const token = await this.issueToken(loaded.metadata.address, loaded.metadata.password);
    const mailbox = await this.fetchMe(token);
    const status = this.activeStatus(`Temp mailbox ${mailbox.address} is ready.`);
    const user = toTempMailUser(mailbox);
    await this.persistConnection(loaded, {
      mailbox,
      status,
      user,
    });

    return {
      ...loaded,
      token,
      mailbox,
      user,
    };
  }

  private async loadConnection(account?: string): Promise<LoadedTempMailConnection> {
    const loaded = await this.connectionStore.loadSessionConnection(this.platform, account);
    const metadata = parseTempMailSessionMetadata(loaded.connection.metadata);

    return {
      account: loaded.connection.account,
      path: loaded.path,
      connection: loaded.connection,
      metadata,
    };
  }

  private async persistConnection(
    loaded: LoadedTempMailConnection,
    input: {
      mailbox: TempMailMailbox;
      status: SessionStatus;
      user?: SessionUser;
    },
  ): Promise<void> {
    const mailbox = input.mailbox;
    await this.connectionStore.saveSessionConnection({
      platform: this.platform,
      account: loaded.account,
      provider: "mail.tm",
      user: input.user ?? loaded.connection.user,
      status: input.status,
      metadata: {
        ...loaded.metadata,
        address: mailbox.address,
        accountId: mailbox.id,
        domain: mailbox.address.split("@")[1] ?? loaded.metadata.domain,
      } satisfies TempMailSessionMetadata,
    });
  }

  private createClient(token?: string): SessionHttpClient {
    return new SessionHttpClient(undefined, {
      accept: "application/json",
      "user-agent": "AutoCLI/1.0 (+https://github.com/vkop007/autocli)",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    });
  }

  private async listDomains(): Promise<TempMailDomain[]> {
    const payload = await this.createClient().request<HydraCollection<Record<string, unknown>> | Record<string, unknown>[]>(
      `${MAIL_TM_API_BASE_URL}/domains`,
      {
        expectedStatus: 200,
      },
    );

    return extractTempMailCollectionItems(payload).map(parseTempMailDomain);
  }

  private async createRemoteAccount(address: string, password: string): Promise<TempMailMailbox> {
    const payload = await this.createClient().request<Record<string, unknown>>(
      `${MAIL_TM_API_BASE_URL}/accounts`,
      {
        method: "POST",
        expectedStatus: 201,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          address,
          password,
        }),
      },
    ).catch((error) => {
      throw wrapTempMailRequestError(error, "Unable to create the temp mailbox.");
    });

    return parseTempMailMailbox(payload);
  }

  private async issueToken(address: string, password: string): Promise<string> {
    const payload = await this.createClient().request<TempMailTokenResponse>(
      `${MAIL_TM_API_BASE_URL}/token`,
      {
        method: "POST",
        expectedStatus: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          address,
          password,
        }),
      },
    ).catch((error) => {
      throw wrapTempMailRequestError(error, "Unable to authenticate with the temp mailbox.");
    });

    if (typeof payload.token !== "string" || payload.token.length === 0) {
      throw new AutoCliError("TEMPMAIL_TOKEN_INVALID", "Mail.tm did not return a bearer token.");
    }

    return payload.token;
  }

  private async fetchMe(token: string): Promise<TempMailMailbox> {
    const payload = await this.createClient(token).request<Record<string, unknown>>(
      `${MAIL_TM_API_BASE_URL}/me`,
      {
        expectedStatus: 200,
      },
    ).catch((error) => {
      throw wrapTempMailRequestError(error, "Unable to load the temp mailbox details.");
    });

    return parseTempMailMailbox(payload);
  }

  private async listMessages(token: string, limit: number): Promise<TempMailMessage[]> {
    const client = this.createClient(token);
    const items: TempMailMessage[] = [];
    const pageSize = 30;
    const maxPages = Math.max(1, Math.ceil(limit / pageSize));

    for (let page = 1; page <= maxPages && items.length < limit; page += 1) {
      const payload = await client.request<HydraCollection<Record<string, unknown>> | Record<string, unknown>[]>(
        `${MAIL_TM_API_BASE_URL}/messages?page=${page}`,
        {
          expectedStatus: 200,
        },
      ).catch((error) => {
        throw wrapTempMailRequestError(error, "Unable to load the temp mailbox inbox.");
      });

      const batch = extractTempMailCollectionItems(payload).map(parseTempMailMessage);
      if (batch.length === 0) {
        break;
      }

      items.push(...batch);
      const totalItems = Array.isArray(payload) ? undefined : (typeof payload["hydra:totalItems"] === "number" ? payload["hydra:totalItems"] : undefined);
      if (typeof totalItems === "number" && items.length >= totalItems) {
        break;
      }
    }

    return items.slice(0, limit);
  }

  private async getMessage(token: string, id: string): Promise<TempMailMessage> {
    const payload = await this.createClient(token).request<Record<string, unknown>>(
      `${MAIL_TM_API_BASE_URL}/messages/${encodeURIComponent(id)}`,
      {
        expectedStatus: 200,
      },
    ).catch((error) => {
      throw wrapTempMailRequestError(error, `Unable to load temp mail message ${id}.`);
    });

    return parseTempMailMessage(payload);
  }

  private async markMessageRead(token: string, id: string): Promise<void> {
    await this.createClient(token).request<Record<string, unknown>>(
      `${MAIL_TM_API_BASE_URL}/messages/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        expectedStatus: 200,
      },
    ).catch((error) => {
      throw wrapTempMailRequestError(error, `Unable to mark temp mail message ${id} as read.`);
    });
  }

  private async deleteRemoteMessage(token: string, id: string): Promise<void> {
    await this.createClient(token).request(
      `${MAIL_TM_API_BASE_URL}/messages/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        expectedStatus: 204,
      },
    ).catch((error) => {
      throw wrapTempMailRequestError(error, `Unable to delete temp mail message ${id}.`);
    });
  }

  private async deleteRemoteAccount(token: string, id: string): Promise<void> {
    await this.createClient(token).request(
      `${MAIL_TM_API_BASE_URL}/accounts/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        expectedStatus: 204,
      },
    ).catch((error) => {
      throw wrapTempMailRequestError(error, "Unable to delete the temp mailbox.");
    });
  }

  private activeStatus(message: string): SessionStatus {
    return {
      state: "active",
      message,
      lastValidatedAt: new Date().toISOString(),
    };
  }

  private expiredStatus(message: string, code?: string): SessionStatus {
    return {
      state: "expired",
      message,
      lastValidatedAt: new Date().toISOString(),
      ...(code ? { lastErrorCode: code } : {}),
    };
  }

  private buildStatusResult(input: {
    account: string;
    sessionPath: string;
    status: SessionStatus;
    user?: SessionUser;
  }): AdapterStatusResult {
    return {
      platform: this.platform,
      account: input.account,
      sessionPath: input.sessionPath,
      connected: input.status.state === "active",
      status: input.status.state,
      message: input.status.message,
      user: input.user,
      lastValidatedAt: input.status.lastValidatedAt,
    };
  }

  private buildResult(input: {
    account: string;
    action: string;
    message: string;
    sessionPath?: string;
    user?: SessionUser;
    id?: string;
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
      id: input.id,
      data: input.data,
    };
  }
}

export const tempMailAdapter = new TempMailAdapter();

export function buildTempMailAddress(localPart: string, domain: string): string {
  return `${localPart}@${domain}`;
}

export function normalizeTempMailLocalPart(value: string): string {
  const normalized = value.trim().toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (safe.length < 3) {
    throw new AutoCliError(
      "TEMPMAIL_NAME_INVALID",
      "Temp mailbox local part must contain at least 3 letters or numbers after normalization.",
      {
        details: {
          value,
        },
      },
    );
  }

  return safe;
}

export function pickTempMailDomain(domains: readonly TempMailDomain[], requestedDomain?: string): TempMailDomain {
  const normalizedRequested = normalizeOptionalString(requestedDomain)?.toLowerCase();
  if (normalizedRequested) {
    const requested = domains.find((domain) => domain.domain.toLowerCase() === normalizedRequested);
    if (!requested) {
      throw new AutoCliError("TEMPMAIL_DOMAIN_NOT_FOUND", `Temp mail domain "${requestedDomain}" is not available right now.`);
    }
    if (!requested.isActive || requested.isPrivate) {
      throw new AutoCliError("TEMPMAIL_DOMAIN_UNAVAILABLE", `Temp mail domain "${requested.domain}" is not publicly available right now.`);
    }

    return requested;
  }

  const defaultDomain = domains.find((domain) => domain.isActive && !domain.isPrivate) ?? domains.find((domain) => domain.isActive) ?? domains[0];
  if (!defaultDomain) {
    throw new AutoCliError("TEMPMAIL_DOMAIN_NOT_FOUND", "Mail.tm did not return any available temp-mail domains.");
  }

  return defaultDomain;
}

export function extractVerificationCodes(value: string): string[] {
  const matches = value.match(/\b\d{4,8}\b/g) ?? [];
  return Array.from(new Set(matches));
}

export function extractLinks(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return Array.from(new Set(matches));
}

function summarizeDomain(domain: TempMailDomain): Record<string, unknown> {
  return {
    id: domain.id,
    domain: domain.domain,
    isActive: domain.isActive,
    isPrivate: domain.isPrivate,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
  };
}

function summarizeMailbox(mailbox: TempMailMailbox): TempMailMailboxSummary {
  const domain = mailbox.address.split("@")[1];
  const quota = normalizeFiniteNumber(mailbox.quota);
  const used = normalizeFiniteNumber(mailbox.used);
  return {
    id: mailbox.id,
    address: mailbox.address,
    domain,
    quota,
    used,
    usagePercent:
      typeof quota === "number" && quota > 0 && typeof used === "number"
        ? Math.round((used / quota) * 100)
        : undefined,
    isDisabled: mailbox.isDisabled,
    isDeleted: mailbox.isDeleted,
    createdAt: mailbox.createdAt,
    updatedAt: mailbox.updatedAt,
    providerUrl: MAIL_TM_HOME_URL,
    docsUrl: MAIL_TM_DOCS_URL,
  };
}

function summarizeMessage(message: TempMailMessage): TempMailMessageSummary {
  const bodyText = collapseWhitespace(message.intro ?? message.text ?? flattenHtml(message.html));
  const verificationCodes = bodyText ? extractVerificationCodes(bodyText) : [];

  return {
    id: message.id,
    subject: normalizeOptionalString(message.subject) ?? "(no subject)",
    intro: bodyText,
    fromName: normalizeOptionalString(message.from?.name),
    fromAddress: normalizeOptionalString(message.from?.address),
    to: (message.to ?? []).map(formatRecipient).filter((value): value is string => Boolean(value)),
    seen: message.seen,
    hasAttachments: message.hasAttachments,
    attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : undefined,
    size: normalizeFiniteNumber(message.size),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    downloadUrl: normalizeOptionalString(message.downloadUrl),
    verificationCodes: verificationCodes.length > 0 ? verificationCodes : undefined,
  };
}

function summarizeMessageDetail(message: TempMailMessage): TempMailMessageDetail {
  const text = normalizeOptionalString(message.text) ?? normalizeOptionalString(flattenHtml(message.html));
  const codes = text ? extractVerificationCodes(text) : [];
  const links = text ? extractLinks(text) : [];

  return {
    ...summarizeMessage(message),
    text,
    html: Array.isArray(message.html) && message.html.length > 0 ? message.html : undefined,
    links: links.length > 0 ? links : undefined,
    verificationCodes: codes.length > 0 ? codes : undefined,
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      filename: normalizeOptionalString(attachment.filename),
      contentType: normalizeOptionalString(attachment.contentType),
      size: normalizeFiniteNumber(attachment.size),
      downloadUrl: normalizeOptionalString(attachment.downloadUrl),
    })),
  };
}

function parseTempMailDomain(value: Record<string, unknown>): TempMailDomain {
  return {
    id: requireString(value.id, "Mail.tm domain is missing id."),
    domain: requireString(value.domain, "Mail.tm domain is missing domain."),
    isActive: value.isActive === true,
    isPrivate: value.isPrivate === true,
    createdAt: asString(value.createdAt),
    updatedAt: asString(value.updatedAt),
  };
}

function parseTempMailMailbox(value: Record<string, unknown>): TempMailMailbox {
  return {
    id: requireString(value.id, "Mail.tm mailbox is missing id."),
    address: requireString(value.address, "Mail.tm mailbox is missing address."),
    quota: asNumber(value.quota),
    used: asNumber(value.used),
    isDisabled: value.isDisabled === true,
    isDeleted: value.isDeleted === true,
    createdAt: asString(value.createdAt),
    updatedAt: asString(value.updatedAt),
  };
}

function parseTempMailMessage(value: Record<string, unknown>): TempMailMessage {
  return {
    id: requireString(value.id, "Mail.tm message is missing id."),
    accountId: asString(value.accountId),
    msgid: asString(value.msgid),
    from: parseTempMailAddress(asRecord(value.from)),
    to: asRecordArray(value.to)
      .map(parseTempMailAddress)
      .filter((entry): entry is TempMailAddress => Boolean(entry)),
    subject: asString(value.subject),
    intro: asString(value.intro),
    text: asString(value.text),
    html: Array.isArray(value.html) ? value.html.filter((entry): entry is string => typeof entry === "string") : undefined,
    seen: value.seen === true,
    flagged: value.flagged === true,
    isDeleted: value.isDeleted === true,
    hasAttachments: value.hasAttachments === true,
    attachments: asRecordArray(value.attachments).map(parseTempMailAttachment),
    size: asNumber(value.size),
    downloadUrl: asString(value.downloadUrl),
    createdAt: asString(value.createdAt),
    updatedAt: asString(value.updatedAt),
  };
}

function parseTempMailAttachment(value: Record<string, unknown>): TempMailAttachment {
  return {
    id: requireString(value.id, "Mail.tm attachment is missing id."),
    filename: asString(value.filename),
    contentType: asString(value.contentType),
    disposition: asString(value.disposition),
    transferEncoding: asString(value.transferEncoding),
    related: value.related === true,
    size: asNumber(value.size),
    downloadUrl: asString(value.downloadUrl),
  };
}

function parseTempMailAddress(value: Record<string, unknown> | undefined): TempMailAddress | undefined {
  if (!value) {
    return undefined;
  }

  return {
    name: asString(value.name),
    address: asString(value.address),
  };
}

function parseTempMailSessionMetadata(value: unknown): TempMailSessionMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AutoCliError("TEMPMAIL_CONNECTION_INVALID", "Saved temp mail connection metadata is missing.");
  }

  const metadata = value as Partial<TempMailSessionMetadata>;
  if (
    typeof metadata.address !== "string" ||
    typeof metadata.password !== "string" ||
    typeof metadata.accountId !== "string" ||
    typeof metadata.domain !== "string"
  ) {
    throw new AutoCliError("TEMPMAIL_CONNECTION_INVALID", "Saved temp mail connection metadata is incomplete.");
  }

  return {
    address: metadata.address,
    password: metadata.password,
    accountId: metadata.accountId,
    domain: metadata.domain,
    providerUrl: typeof metadata.providerUrl === "string" ? metadata.providerUrl : MAIL_TM_HOME_URL,
    docsUrl: typeof metadata.docsUrl === "string" ? metadata.docsUrl : MAIL_TM_DOCS_URL,
  };
}

function extractHydraMembers<T>(value: HydraCollection<T>): T[] {
  return Array.isArray(value["hydra:member"]) ? value["hydra:member"] : [];
}

function extractTempMailCollectionItems(value: HydraCollection<Record<string, unknown>> | Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  }

  return extractHydraMembers(value);
}

function toTempMailUser(mailbox: TempMailMailbox): SessionUser {
  return {
    id: mailbox.id,
    username: mailbox.address,
    displayName: mailbox.address,
  };
}

function formatRecipient(value: TempMailAddress): string | undefined {
  const address = normalizeOptionalString(value.address);
  const name = normalizeOptionalString(value.name);
  if (name && address) {
    return `${name} <${address}>`;
  }

  return name ?? address;
}

function flattenHtml(value: string[] | undefined): string {
  if (!Array.isArray(value) || value.length === 0) {
    return "";
  }

  return collapseWhitespace(
    value
      .join("\n")
      .replace(/<style[\s\S]*?<\/style>/giu, " ")
      .replace(/<script[\s\S]*?<\/script>/giu, " ")
      .replace(/<[^>]+>/g, " "),
  ) ?? "";
}

function collapseWhitespace(value: string): string | undefined {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveSavedTempMailAccountName(account: string | undefined, address: string): string {
  const localPart = address.split("@")[0] ?? "default";
  return sanitizeAccountName(account ?? localPart);
}

function createRandomTempMailLocalPart(): string {
  return `autocli-${randomBytes(4).toString("hex")}`;
}

function createRandomTempMailPassword(): string {
  return randomBytes(18).toString("base64url");
}

function requireTempMailPassword(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new AutoCliError("TEMPMAIL_PASSWORD_REQUIRED", message);
  }

  return normalized;
}

function wrapTempMailRequestError(error: unknown, message: string): AutoCliError {
  if (error instanceof AutoCliError) {
    return new AutoCliError(error.code, message, {
      cause: error,
      details: error.details,
    });
  }

  return new AutoCliError("TEMPMAIL_REQUEST_FAILED", message, {
    cause: error,
  });
}

function normalizeInboxLimit(value: number | undefined, fallback: number): number {
  const normalized = normalizePositiveInteger(value, fallback);
  return Math.max(1, Math.min(normalized, MAX_INBOX_LIMIT));
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireString(value: unknown, message: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new AutoCliError("TEMPMAIL_RESPONSE_INVALID", message);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}
