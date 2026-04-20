import { MikaCliError } from "../../../errors.js";
import { DocsApiClient } from "./client.js";
import { BaseGooglePlatformAdapter } from "../shared/base.js";

import type { AdapterActionResult } from "../../../types.js";

export class DocsAdapter extends BaseGooglePlatformAdapter {
  readonly platform = "docs" as const;
  protected readonly defaultScopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ] as const;

  async documents(input: { account?: string; query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const documents = await this.createClient(active.accessToken).listDocuments(input);

    return this.buildActionResult({
      account: active.account,
      action: "documents",
      message: `Loaded ${documents.length} Google Doc${documents.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        documents,
      },
    });
  }

  async document(input: { account?: string; documentId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const document = await this.createClient(active.accessToken).getDocument(input.documentId);

    return this.buildActionResult({
      account: active.account,
      action: "document",
      message: `Loaded Google Doc ${input.documentId}.`,
      sessionPath: active.path,
      user: active.user,
      id: document.id,
      url: document.webViewLink,
      data: {
        document,
      },
    });
  }

  async content(input: { account?: string; documentId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const document = await this.createClient(active.accessToken).getDocument(input.documentId);

    return this.buildActionResult({
      account: active.account,
      action: "content",
      message: `Loaded Google Doc content for ${input.documentId}.`,
      sessionPath: active.path,
      user: active.user,
      id: document.id,
      url: document.webViewLink,
      data: {
        document,
        text: document.text ?? "",
      },
    });
  }

  async create(input: { account?: string; title: string; text?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const document = await this.createClient(active.accessToken).createDocument(input);

    return this.buildActionResult({
      account: active.account,
      action: "create",
      message: `Created Google Doc ${input.title}.`,
      sessionPath: active.path,
      user: active.user,
      id: document.id,
      url: document.webViewLink,
      data: {
        document,
      },
    });
  }

  async appendText(input: { account?: string; documentId: string; text: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const text = input.text.trim();
    if (!text) {
      throw new MikaCliError("GOOGLE_DOCS_TEXT_REQUIRED", "Google Docs append-text requires text.");
    }

    const result = await this.createClient(active.accessToken).appendText({
      documentId: input.documentId,
      text,
    });

    return this.buildActionResult({
      account: active.account,
      action: "append-text",
      message: `Appended text to Google Doc ${input.documentId}.`,
      sessionPath: active.path,
      user: active.user,
      id: result.document.id,
      url: result.document.webViewLink,
      data: {
        document: result.document,
        insertedChars: result.insertedChars,
      },
    });
  }

  async replaceText(input: {
    account?: string;
    documentId: string;
    search: string;
    replace: string;
    matchCase?: boolean;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    if (!input.search.trim()) {
      throw new MikaCliError("GOOGLE_DOCS_SEARCH_REQUIRED", "Google Docs replace-text requires --search.");
    }

    const result = await this.createClient(active.accessToken).replaceText({
      documentId: input.documentId,
      search: input.search,
      replace: input.replace,
      matchCase: input.matchCase,
    });

    return this.buildActionResult({
      account: active.account,
      action: "replace-text",
      message: `Replaced text in Google Doc ${input.documentId}.`,
      sessionPath: active.path,
      user: active.user,
      id: result.document.id,
      url: result.document.webViewLink,
      data: {
        document: result.document,
        occurrencesChanged: result.occurrencesChanged,
      },
    });
  }

  private createClient(accessToken: string): DocsApiClient {
    return new DocsApiClient(accessToken, this.fetchImpl);
  }
}

export const docsAdapter = new DocsAdapter();
