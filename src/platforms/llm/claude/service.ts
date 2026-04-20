import { randomUUID } from "node:crypto";

import { MikaCliError, isMikaCliError } from "../../../errors.js";
import { readMediaFile } from "../../../utils/media.js";
import { appendUploadFileField } from "../../../utils/upload-pipeline.js";

import type { SessionHttpClient } from "../../../utils/http-client.js";
import type { SessionStatus } from "../../../types.js";

const CLAUDE_BASE_URL = "https://claude.ai";
const CLAUDE_ORGANIZATIONS_URL = `${CLAUDE_BASE_URL}/api/organizations`;
const CLAUDE_DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const CLAUDE_ACCEPT_LANGUAGE = "en-US,en;q=0.9";

interface ClaudeOrganization {
  uuid?: string;
  name?: string;
}

interface ClaudeUploadResponse {
  file_uuid?: string;
}

interface ClaudeServiceContext {
  organizationId: string;
  organizationName?: string;
}

interface ClaudeStreamErrorPayload {
  type?: string;
  message?: string;
  resets_at?: number | string;
}

interface ClaudeStreamPayload {
  completion?: string;
  model?: string;
  stop_reason?: string | null;
  error?: ClaudeStreamErrorPayload;
}

export interface ClaudeInspectionResult {
  status: SessionStatus;
  organizationId?: string;
  organizationName?: string;
}

export interface ClaudeTextExecutionResult {
  outputText: string;
  chatId: string;
  url: string;
  organizationId: string;
  organizationName?: string;
  model: string;
}

export interface ClaudeImageExecutionResult extends ClaudeTextExecutionResult {
  fileId: string;
}

export class ClaudeService {
  async inspectSession(
    client: SessionHttpClient,
    preferredOrganizationId?: string,
  ): Promise<ClaudeInspectionResult> {
    try {
      const context = await this.createContext(client, preferredOrganizationId);
      return {
        status: {
          state: "active",
          message: "Claude session is active.",
          lastValidatedAt: new Date().toISOString(),
        },
        organizationId: context.organizationId,
        organizationName: context.organizationName,
      };
    } catch (error) {
      if (isClaudeExpiredError(error)) {
        return {
          status: {
            state: "expired",
            message: "Claude session expired. Re-import cookies.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "SESSION_EXPIRED",
          },
        };
      }

      if (isMikaCliError(error)) {
        return {
          status: {
            state: "unknown",
            message: error.message,
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: error.code,
          },
        };
      }

      throw error;
    }
  }

  async executeText(
    client: SessionHttpClient,
    input: {
      prompt: string;
      model?: string;
      preferredOrganizationId?: string;
    },
  ): Promise<ClaudeTextExecutionResult> {
    try {
      const organizations = await this.fetchOrganizations(client);
      const candidates = orderClaudeOrganizations(organizations, input.preferredOrganizationId);
      let fallbackError: MikaCliError | undefined;

      for (const candidate of candidates) {
        if (!candidate.uuid) {
          continue;
        }

        try {
          const chatId = await this.createChat(client, candidate.uuid);
          const stream = await this.sendMessage(client, candidate.uuid, chatId, {
            prompt: input.prompt,
            model: input.model,
          });
          const parsed = parseClaudeCompletionStream(stream);

          if (!parsed.outputText) {
            throw new MikaCliError("CLAUDE_EMPTY_RESPONSE", "Claude returned an empty response.");
          }

          return {
            outputText: parsed.outputText,
            chatId,
            url: `${CLAUDE_BASE_URL}/chat/${chatId}`,
            organizationId: candidate.uuid,
            organizationName: candidate.name,
            model: input.model?.trim() || parsed.model || "default",
          };
        } catch (error) {
          if (isClaudeOrganizationAuthError(error)) {
            fallbackError = asMikaCliError(error);
            continue;
          }
          throw error;
        }
      }

      throw fallbackError ?? new MikaCliError(
        "CLAUDE_ORGANIZATION_FORBIDDEN",
        "Claude denied message access for all detected organizations. Re-import cookies from the active organization session.",
        {
          details: {
            organizationCount: candidates.length,
          },
        },
      );
    } catch (error) {
      throw mapClaudeError(error, "Failed to complete the Claude prompt.");
    }
  }

  async executeImage(
    client: SessionHttpClient,
    input: {
      mediaPath: string;
      caption?: string;
      model?: string;
      preferredOrganizationId?: string;
    },
  ): Promise<ClaudeImageExecutionResult> {
    try {
      const media = await readMediaFile(input.mediaPath);
      const organizations = await this.fetchOrganizations(client);
      const candidates = orderClaudeOrganizations(organizations, input.preferredOrganizationId);
      let fallbackError: MikaCliError | undefined;

      for (const candidate of candidates) {
        if (!candidate.uuid) {
          continue;
        }

        try {
          const chatId = await this.createChat(client, candidate.uuid);
          const fileId = await this.uploadFile(client, candidate.uuid, chatId, media);
          const stream = await this.sendMessage(client, candidate.uuid, chatId, {
            prompt: input.caption?.trim() || "Describe this image.",
            model: input.model,
            fileIds: [fileId],
          });
          const parsed = parseClaudeCompletionStream(stream);

          if (!parsed.outputText) {
            throw new MikaCliError("CLAUDE_EMPTY_RESPONSE", "Claude returned an empty response for the uploaded image.");
          }

          return {
            outputText: parsed.outputText,
            chatId,
            url: `${CLAUDE_BASE_URL}/chat/${chatId}`,
            organizationId: candidate.uuid,
            organizationName: candidate.name,
            model: input.model?.trim() || parsed.model || "default",
            fileId,
          };
        } catch (error) {
          if (isClaudeOrganizationAuthError(error)) {
            fallbackError = asMikaCliError(error);
            continue;
          }
          throw error;
        }
      }

      throw fallbackError ?? new MikaCliError(
        "CLAUDE_ORGANIZATION_FORBIDDEN",
        "Claude denied message access for all detected organizations. Re-import cookies from the active organization session.",
        {
          details: {
            organizationCount: candidates.length,
          },
        },
      );
    } catch (error) {
      throw mapClaudeError(error, "Failed to complete the Claude image prompt.");
    }
  }

  private async createContext(client: SessionHttpClient, preferredOrganizationId?: string): Promise<ClaudeServiceContext> {
    const organizations = await this.fetchOrganizations(client);
    const selected = selectClaudeOrganization(organizations, preferredOrganizationId);

    if (!selected?.uuid) {
      throw new MikaCliError("CLAUDE_ORGANIZATION_NOT_FOUND", "Claude did not return an accessible organization for this session.");
    }

    return {
      organizationId: selected.uuid,
      organizationName: selected.name,
    };
  }

  private async fetchOrganizations(client: SessionHttpClient): Promise<ClaudeOrganization[]> {
    const text = await client.request<string>(CLAUDE_ORGANIZATIONS_URL, {
      headers: buildClaudeHeaders({
        accept: "application/json",
        referer: `${CLAUDE_BASE_URL}/chats`,
      }),
      responseType: "text",
      expectedStatus: [200, 401, 403],
    });

    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("Expected an array.");
      }
      return parsed.filter((value): value is ClaudeOrganization => Boolean(value) && typeof value === "object");
    } catch (error) {
      throw new MikaCliError("CLAUDE_SESSION_EXPIRED", "Claude session expired. Re-import cookies.", {
        cause: error,
        details: {
          preview: text.slice(0, 200),
        },
      });
    }
  }

  private async createChat(client: SessionHttpClient, organizationId: string): Promise<string> {
    const response = await client.request<{ uuid?: string }>(
      `${CLAUDE_BASE_URL}/api/organizations/${organizationId}/chat_conversations`,
      {
        method: "POST",
        headers: buildClaudeHeaders({
          accept: "application/json",
          referer: `${CLAUDE_BASE_URL}/chats`,
          extra: {
            "content-type": "application/json",
          },
        }),
        body: JSON.stringify({
          name: "",
          uuid: randomUUID(),
        }),
        expectedStatus: 201,
      },
    );

    if (!response.uuid) {
      throw new MikaCliError("CLAUDE_CHAT_CREATE_FAILED", "Claude did not return a chat id.");
    }

    return response.uuid;
  }

  private async uploadFile(
    client: SessionHttpClient,
    organizationId: string,
    chatId: string,
    file: {
      filename: string;
      mimeType: string;
      bytes: Buffer;
    },
  ): Promise<string> {
    const form = new FormData();
    appendUploadFileField(form, "file", file);
    form.append("orgUuid", organizationId);

    const response = await client.request<ClaudeUploadResponse>(`${CLAUDE_BASE_URL}/api/${organizationId}/upload`, {
      method: "POST",
      headers: buildClaudeHeaders({
        accept: "application/json",
        referer: `${CLAUDE_BASE_URL}/chat/${chatId}`,
      }),
      body: form,
      expectedStatus: 200,
    });

    if (!response.file_uuid) {
      throw new MikaCliError("CLAUDE_FILE_UPLOAD_FAILED", "Claude did not return an uploaded file id.");
    }

    return response.file_uuid;
  }

  private async sendMessage(
    client: SessionHttpClient,
    organizationId: string,
    chatId: string,
    input: {
      prompt: string;
      model?: string;
      fileIds?: string[];
    },
  ): Promise<string> {
    return client.request<string>(`${CLAUDE_BASE_URL}/api/organizations/${organizationId}/chat_conversations/${chatId}/completion`, {
      method: "POST",
      headers: buildClaudeHeaders({
        accept: "text/event-stream, text/event-stream",
        referer: `${CLAUDE_BASE_URL}/chat/${chatId}`,
        extra: {
          "content-type": "application/json",
        },
      }),
      body: JSON.stringify({
        attachments: [],
        files: input.fileIds ?? [],
        prompt: input.prompt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        ...(input.model?.trim() ? { model: input.model.trim() } : {}),
      }),
      responseType: "text",
      expectedStatus: 200,
    });
  }
}

export function parseClaudeCompletionStream(stream: string): {
  outputText: string;
  model?: string;
} {
  const completions: string[] = [];
  let model: string | undefined;

  for (const line of stream.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(/\{.*\}/u);
    if (!match) {
      continue;
    }

    let payload: ClaudeStreamPayload;
    try {
      payload = JSON.parse(match[0]) as ClaudeStreamPayload;
    } catch {
      continue;
    }

    if (payload.error) {
      const resetsAt = payload.error.resets_at;
      if (typeof resetsAt === "number" || typeof resetsAt === "string") {
        throw new MikaCliError("CLAUDE_RATE_LIMITED", "Claude rate limited this session.", {
          details: {
            resetsAt,
          },
        });
      }

      if (typeof payload.error.type === "string" && payload.error.type.includes("overloaded")) {
        throw new MikaCliError("CLAUDE_OVERLOADED", payload.error.message || "Claude is currently overloaded.");
      }

      throw new MikaCliError("CLAUDE_STREAM_ERROR", payload.error.message || "Claude returned an error event.", {
        details: {
          type: payload.error.type,
        },
      });
    }

    if (typeof payload.completion === "string" && payload.completion.length > 0) {
      completions.push(payload.completion);
    }

    if (typeof payload.model === "string" && payload.model.length > 0) {
      model = payload.model;
    }
  }

  return {
    outputText: completions.join("").trim(),
    model,
  };
}

function selectClaudeOrganization(
  organizations: ClaudeOrganization[],
  preferredOrganizationId?: string,
): ClaudeOrganization | undefined {
  if (preferredOrganizationId) {
    const selected = organizations.find((organization) => organization.uuid === preferredOrganizationId);
    if (selected) {
      return selected;
    }
  }

  return organizations.at(-1) ?? organizations[0];
}

function orderClaudeOrganizations(
  organizations: ClaudeOrganization[],
  preferredOrganizationId?: string,
): ClaudeOrganization[] {
  if (!preferredOrganizationId) {
    return [...organizations];
  }

  const preferred = organizations.filter((organization) => organization.uuid === preferredOrganizationId);
  const others = organizations.filter((organization) => organization.uuid !== preferredOrganizationId);
  return [...preferred, ...others];
}

function buildClaudeHeaders(input: {
  accept: string;
  referer: string;
  extra?: Record<string, string>;
}): Record<string, string> {
  return {
    accept: input.accept,
    "accept-language": CLAUDE_ACCEPT_LANGUAGE,
    origin: CLAUDE_BASE_URL,
    referer: input.referer,
    "user-agent": CLAUDE_DEFAULT_USER_AGENT,
    ...(input.extra ?? {}),
  };
}

function isClaudeExpiredError(error: unknown): boolean {
  return isMikaCliError(error) && [
    "CLAUDE_SESSION_EXPIRED",
    "CLAUDE_ORGANIZATION_NOT_FOUND",
  ].includes(error.code);
}

function isClaudeOrganizationAuthError(error: unknown): boolean {
  if (!isMikaCliError(error)) {
    return false;
  }

  if (error.code === "CLAUDE_ORGANIZATION_FORBIDDEN") {
    return true;
  }

  if (error.code !== "HTTP_REQUEST_FAILED") {
    return false;
  }

  const status = Number(error.details?.status);
  const body = typeof error.details?.body === "string" ? error.details.body : "";
  return status === 403 && /Invalid authorization for organization/i.test(body);
}

function asMikaCliError(error: unknown): MikaCliError | undefined {
  return isMikaCliError(error) ? error : undefined;
}

function mapClaudeError(error: unknown, fallbackMessage: string): MikaCliError {
  if (isMikaCliError(error)) {
    if (error.code === "HTTP_REQUEST_FAILED") {
      const status = Number(error.details?.status);
      const body = typeof error.details?.body === "string" ? error.details.body : "";
      if (status === 403 && /Invalid authorization for organization/i.test(body)) {
        return new MikaCliError(
          "CLAUDE_ORGANIZATION_FORBIDDEN",
          "Claude rejected the selected organization for write access. MikaCLI will retry with other available organizations.",
          {
            details: error.details,
          },
        );
      }
      if (status === 401 || status === 403) {
        return new MikaCliError("CLAUDE_SESSION_EXPIRED", "Claude session expired. Re-import cookies.", {
          details: error.details,
        });
      }

      if (status === 429) {
        return new MikaCliError("CLAUDE_RATE_LIMITED", "Claude rate limited this session.", {
          details: error.details,
        });
      }
    }

    return error;
  }

  if (error instanceof Error) {
    return new MikaCliError("CLAUDE_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details: {
        message: error.message,
      },
    });
  }

  return new MikaCliError("CLAUDE_REQUEST_FAILED", fallbackMessage);
}
