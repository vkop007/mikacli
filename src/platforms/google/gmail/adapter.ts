import { GmailApiClient } from "./client.js";
import { BaseGooglePlatformAdapter } from "../shared/base.js";

import type { AdapterActionResult } from "../../../types.js";

export class GmailAdapter extends BaseGooglePlatformAdapter {
  readonly platform = "gmail" as const;
  protected readonly defaultScopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ] as const;

  async me(account?: string): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(account);
    const client = this.createClient(active.accessToken);
    const profile = await client.getProfile();

    return this.buildActionResult({
      account: active.account,
      action: "me",
      message: "Loaded Gmail account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        profile: {
          ...this.summarizeProfile(active.profile),
          email: profile.emailAddress ?? active.profile.email,
          messagesTotal: profile.messagesTotal,
          threadsTotal: profile.threadsTotal,
          historyId: profile.historyId,
        },
        scopes: active.scopes,
      },
    });
  }

  async labels(account?: string): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(account);
    const labels = await this.createClient(active.accessToken).listLabels();

    return this.buildActionResult({
      account: active.account,
      action: "labels",
      message: `Loaded ${labels.length} Gmail label${labels.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        labels,
      },
    });
  }

  async messages(input: { account?: string; query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const messages = await this.createClient(active.accessToken).listMessages({
      query: input.query,
      limit: input.limit,
    });

    return this.buildActionResult({
      account: active.account,
      action: "messages",
      message: `Loaded ${messages.length} Gmail message${messages.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        messages,
      },
    });
  }

  async message(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const message = await this.createClient(active.accessToken).getMessage(input.id);

    return this.buildActionResult({
      account: active.account,
      action: "message",
      message: `Loaded Gmail message ${input.id}.`,
      id: message.id,
      url: message.url,
      sessionPath: active.path,
      user: active.user,
      data: {
        message,
      },
    });
  }

  async send(input: {
    account?: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string;
    bcc?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const sent = await this.createClient(active.accessToken).sendMessage(input);

    return this.buildActionResult({
      account: active.account,
      action: "send",
      message: `Sent Gmail message to ${input.to}.`,
      id: sent.id,
      url: sent.id ? `https://mail.google.com/mail/u/0/#all/${sent.id}` : undefined,
      sessionPath: active.path,
      user: active.user,
      data: {
        message: {
          id: sent.id,
          threadId: sent.threadId,
          to: input.to,
          subject: input.subject,
        },
      },
    });
  }

  private createClient(accessToken: string): GmailApiClient {
    return new GmailApiClient(accessToken, this.fetchImpl);
  }
}

export const gmailAdapter = new GmailAdapter();
