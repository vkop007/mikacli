import { AutoCliError } from "../../../errors.js";
import { GoogleApiClient } from "../shared/client.js";

export interface GoogleDocSummary {
  id?: string;
  title?: string;
  createdTime?: string;
  modifiedTime?: string;
  ownerName?: string;
  ownerEmail?: string;
  webViewLink?: string;
}

export interface GoogleDocDetail extends GoogleDocSummary {
  revisionId?: string;
  text?: string;
  snippet?: string;
  characterCount?: number;
  lineCount?: number;
  endIndex?: number;
}

type DriveFileOwner = {
  displayName?: string;
  emailAddress?: string;
};

type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: DriveFileOwner[];
};

type DocsListResponse = {
  files?: DriveFile[];
};

type DocsTextRun = {
  content?: string;
};

type DocsParagraphElement = {
  textRun?: DocsTextRun;
};

type DocsParagraph = {
  elements?: DocsParagraphElement[];
};

type DocsTableCell = {
  content?: DocsStructuralElement[];
};

type DocsTableRow = {
  tableCells?: DocsTableCell[];
};

type DocsTable = {
  tableRows?: DocsTableRow[];
};

type DocsTableOfContents = {
  content?: DocsStructuralElement[];
};

type DocsStructuralElement = {
  endIndex?: number;
  paragraph?: DocsParagraph;
  table?: DocsTable;
  tableOfContents?: DocsTableOfContents;
};

type DocsDocumentResponse = {
  documentId?: string;
  title?: string;
  revisionId?: string;
  body?: {
    content?: DocsStructuralElement[];
  };
};

type DocsBatchUpdateResponse = {
  replies?: Array<{
    replaceAllText?: {
      occurrencesChanged?: number;
    };
  }>;
};

export class DocsApiClient {
  private readonly docsClient: GoogleApiClient;
  private readonly driveClient: GoogleApiClient;

  constructor(accessToken: string, fetchImpl?: typeof fetch) {
    this.docsClient = new GoogleApiClient({
      accessToken,
      baseUrl: "https://docs.googleapis.com/v1",
      errorCode: "GOOGLE_DOCS_API_ERROR",
      fetchImpl,
    });
    this.driveClient = new GoogleApiClient({
      accessToken,
      baseUrl: "https://www.googleapis.com/drive/v3",
      errorCode: "GOOGLE_DOCS_API_ERROR",
      fetchImpl,
    });
  }

  async listDocuments(input: { query?: string; limit?: number } = {}): Promise<GoogleDocSummary[]> {
    const payload = await this.driveClient.json<DocsListResponse>("/files", {}, {
      q: buildDriveDocsQuery(input.query),
      pageSize: input.limit ?? 20,
      fields: "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,owners(displayName,emailAddress))",
      orderBy: "modifiedTime desc",
    });

    return (payload.files ?? []).map((file) => summarizeDriveDoc(file));
  }

  async getDocument(documentId: string): Promise<GoogleDocDetail> {
    const payload = await this.docsClient.json<DocsDocumentResponse>(`/documents/${encodeURIComponent(documentId)}`);
    return summarizeDocument(payload);
  }

  async createDocument(input: { title: string; text?: string }): Promise<GoogleDocDetail> {
    const created = await this.docsClient.json<DocsDocumentResponse>("/documents", {
      method: "POST",
      body: {
        title: input.title,
      },
    });

    const documentId = created.documentId?.trim();
    if (!documentId) {
      throw new AutoCliError("GOOGLE_DOC_ID_MISSING", "Google Docs did not return a document id.");
    }

    const text = input.text?.trim();
    if (text) {
      await this.insertText(documentId, {
        index: 1,
        text,
      });
    }

    return this.getDocument(documentId);
  }

  async appendText(input: { documentId: string; text: string }): Promise<{ document: GoogleDocDetail; insertedChars: number }> {
    const document = await this.getDocument(input.documentId);
    const index = Math.max(1, (document.endIndex ?? 1) - 1);
    await this.insertText(input.documentId, {
      index,
      text: input.text,
    });
    return {
      document: await this.getDocument(input.documentId),
      insertedChars: input.text.length,
    };
  }

  async replaceText(input: {
    documentId: string;
    search: string;
    replace: string;
    matchCase?: boolean;
  }): Promise<{ document: GoogleDocDetail; occurrencesChanged: number }> {
    const response = await this.docsClient.json<DocsBatchUpdateResponse>(
      `/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
      {
        method: "POST",
        body: {
          requests: [
            {
              replaceAllText: {
                containsText: {
                  text: input.search,
                  matchCase: Boolean(input.matchCase),
                },
                replaceText: input.replace,
              },
            },
          ],
        },
      },
    );

    const occurrencesChanged = response.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;
    return {
      document: await this.getDocument(input.documentId),
      occurrencesChanged,
    };
  }

  private async insertText(documentId: string, input: { index: number; text: string }): Promise<void> {
    await this.docsClient.json(
      `/documents/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: "POST",
        body: {
          requests: [
            {
              insertText: {
                location: {
                  index: input.index,
                },
                text: input.text,
              },
            },
          ],
        },
      },
    );
  }
}

function summarizeDriveDoc(file: DriveFile): GoogleDocSummary {
  const owner = file.owners?.[0];
  return {
    ...(file.id ? { id: file.id } : {}),
    ...(file.name ? { title: file.name } : {}),
    ...(file.createdTime ? { createdTime: file.createdTime } : {}),
    ...(file.modifiedTime ? { modifiedTime: file.modifiedTime } : {}),
    ...(owner?.displayName ? { ownerName: owner.displayName } : {}),
    ...(owner?.emailAddress ? { ownerEmail: owner.emailAddress } : {}),
    ...(file.webViewLink ? { webViewLink: file.webViewLink } : {}),
  };
}

function summarizeDocument(document: DocsDocumentResponse): GoogleDocDetail {
  const content = document.body?.content ?? [];
  const text = extractText(content);
  const normalizedText = text.trimEnd();
  const endIndex = resolveDocumentEndIndex(content);

  return {
    ...(document.documentId ? { id: document.documentId } : {}),
    ...(document.title ? { title: document.title } : {}),
    ...(document.revisionId ? { revisionId: document.revisionId } : {}),
    ...(document.documentId ? { webViewLink: buildDocumentUrl(document.documentId) } : {}),
    ...(normalizedText ? { text: normalizedText } : {}),
    ...(normalizedText ? { snippet: normalizedText.slice(0, 240) } : {}),
    ...(normalizedText ? { characterCount: normalizedText.length } : {}),
    ...(normalizedText ? { lineCount: normalizedText.split(/\r?\n/u).length } : {}),
    ...(endIndex ? { endIndex } : {}),
  };
}

function extractText(elements: readonly DocsStructuralElement[]): string {
  const chunks: string[] = [];

  for (const element of elements) {
    if (element.paragraph?.elements?.length) {
      for (const paragraphElement of element.paragraph.elements) {
        const content = paragraphElement.textRun?.content;
        if (content) {
          chunks.push(content);
        }
      }
    }

    if (element.table?.tableRows?.length) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          if (cell.content?.length) {
            chunks.push(extractText(cell.content));
          }
        }
      }
    }

    if (element.tableOfContents?.content?.length) {
      chunks.push(extractText(element.tableOfContents.content));
    }
  }

  return chunks.join("");
}

function resolveDocumentEndIndex(elements: readonly DocsStructuralElement[]): number {
  return elements.reduce((max, element) => Math.max(max, element.endIndex ?? max), 1);
}

function buildDriveDocsQuery(query: string | undefined): string {
  const base = "mimeType = 'application/vnd.google-apps.document' and trashed = false";
  const trimmed = query?.trim();
  if (!trimmed) {
    return base;
  }

  return `${base} and (${trimmed})`;
}

function buildDocumentUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`;
}
