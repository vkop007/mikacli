import { MikaCliError } from "../../../errors.js";
import { GoogleApiClient } from "../shared/client.js";

export interface GmailProfile {
  emailAddress?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

export interface GmailLabel {
  id?: string;
  name?: string;
  type?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  url: string;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText?: string;
  bodyHtml?: string;
}

type GmailMessagePayload = {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name?: string; value?: string }>;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePayload[];
};

type GmailMessageResponse = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
};

export class GmailApiClient {
  private readonly client: GoogleApiClient;

  constructor(accessToken: string, fetchImpl?: typeof fetch) {
    this.client = new GoogleApiClient({
      accessToken,
      baseUrl: "https://gmail.googleapis.com/gmail/v1/users/me",
      errorCode: "GMAIL_API_ERROR",
      fetchImpl,
    });
  }

  async getProfile(): Promise<GmailProfile> {
    return this.client.json<GmailProfile>("/profile");
  }

  async listLabels(): Promise<GmailLabel[]> {
    const payload = await this.client.json<{ labels?: GmailLabel[] }>("/labels");
    return payload.labels ?? [];
  }

  async listMessages(input: { query?: string; limit?: number }): Promise<GmailMessageSummary[]> {
    const payload = await this.client.json<{ messages?: Array<{ id?: string }> }>("/messages", {}, {
      q: input.query,
      maxResults: input.limit ?? 20,
    });
    const ids = (payload.messages ?? []).map((item) => item.id).filter((value): value is string => typeof value === "string" && value.length > 0);
    const messages = await Promise.all(ids.map((id) => this.getMessage(id, "metadata")));
    return messages.map((message) => summarizeMessage(message));
  }

  async getMessage(id: string, format: "full" | "metadata" = "full"): Promise<GmailMessageDetail> {
    const payload = await this.client.json<GmailMessageResponse>(`/messages/${encodeURIComponent(id)}`, {}, {
      format,
      metadataHeaders: format === "metadata" ? "Subject" : undefined,
    });
    return summarizeMessage(payload, format === "full");
  }

  async sendMessage(input: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string;
    bcc?: string;
  }): Promise<{ id?: string; threadId?: string }> {
    const text = input.text?.trim();
    const html = input.html?.trim();
    if (!text && !html) {
      throw new MikaCliError("GMAIL_MESSAGE_BODY_REQUIRED", "Gmail send requires either message text or --html.");
    }

    const raw = toBase64Url(buildMimeMessage(input));
    return this.client.json<{ id?: string; threadId?: string }>("/messages/send", {
      method: "POST",
      body: {
        raw,
      },
    });
  }
}

function summarizeMessage(message: GmailMessageResponse, includeBody = false): GmailMessageDetail {
  const payload = message.payload;
  const headers = payload?.headers ?? [];
  const subject = findHeader(headers, "subject");
  const from = findHeader(headers, "from");
  const to = findHeader(headers, "to");
  const date = findHeader(headers, "date");
  const bodyText = includeBody ? extractBody(payload, "text/plain") : undefined;
  const bodyHtml = includeBody ? extractBody(payload, "text/html") : undefined;

  return {
    id: message.id ?? "unknown",
    ...(message.threadId ? { threadId: message.threadId } : {}),
    ...(subject ? { subject } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(date ? { date } : {}),
    ...(message.snippet ? { snippet: message.snippet } : {}),
    ...(Array.isArray(message.labelIds) ? { labelIds: message.labelIds } : {}),
    ...(message.internalDate ? { internalDate: message.internalDate } : {}),
    ...(bodyText ? { bodyText } : {}),
    ...(bodyHtml ? { bodyHtml } : {}),
    url: `https://mail.google.com/mail/u/0/#all/${message.id ?? ""}`,
  };
}

function extractBody(payload: GmailMessagePayload | undefined, preferredMimeType: string): string | undefined {
  if (!payload) {
    return undefined;
  }

  if (payload.mimeType === preferredMimeType && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  for (const part of payload.parts ?? []) {
    const nested = extractBody(part, preferredMimeType);
    if (nested) {
      return nested;
    }
  }

  if (!payload.parts?.length && payload.body?.data && payload.mimeType?.startsWith("text/")) {
    return decodeBase64Url(payload.body.data);
  }

  return undefined;
}

function findHeader(headers: Array<{ name?: string; value?: string }>, name: string): string | undefined {
  const target = name.toLowerCase();
  return headers.find((header) => header.name?.toLowerCase() === target)?.value;
}

function buildMimeMessage(input: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
  bcc?: string;
}): string {
  const lines = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
  ];

  if (input.cc?.trim()) {
    lines.push(`Cc: ${input.cc.trim()}`);
  }

  if (input.bcc?.trim()) {
    lines.push(`Bcc: ${input.bcc.trim()}`);
  }

  const text = input.text?.trim();
  const html = input.html?.trim();

  if (text && html) {
    const boundary = `mikacli-boundary-${Date.now()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return [
      ...lines,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      text,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      html,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  lines.push(`Content-Type: ${html ? "text/html" : "text/plain"}; charset=UTF-8`);
  return [
    ...lines,
    "",
    html ?? text ?? "",
    "",
  ].join("\r\n");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}
