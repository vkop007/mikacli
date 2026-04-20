import type { Command } from "commander";
import type { Ora } from "ora";

import type { AdapterActionResult, CommandContext } from "../types.js";
import { errorToJson, isMikaCliError } from "../errors.js";
import { printJson } from "./output.js";
import { setInteractiveProgressHandler } from "./interactive-progress.js";
import { appendActionLog, buildActionLogCommandLabel, markActionLogCaptured } from "./action-log.js";
import { transformOutput, validateSelectFields } from "../core/output/output-transform.js";
import { formatOutput } from "../core/output/format-transformer.js";
import { MikaCliError } from "../errors.js";

let currentCommandPath: string | undefined;
let currentCommandContext: Partial<CommandContext> | undefined;

export function resolveCommandContext(command: Command): CommandContext {
  const options = command.optsWithGlobals<{
    json?: boolean;
    verbose?: boolean;
    select?: string;
    filter?: string;
    format?: string;
  }>();
  const commandPath = buildCommanderCommandPath(command);
  currentCommandPath = commandPath;

  // Parse --select comma-separated fields
  const selectFields = options.select
    ? options.select
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
    : undefined;

  // Validate format
  const format = options.format as CommandContext['format'] | undefined;
  const validFormats = ['json', 'csv', 'table', 'yaml', 'markdown', 'html'];
  if (format && !validFormats.includes(format)) {
    throw new MikaCliError("INVALID_FORMAT", `Unknown format: ${format}. Valid options: ${validFormats.join(', ')}`);
  }

  const context: CommandContext = {
    json: Boolean(options.json),
    verbose: Boolean(options.verbose),
    commandPath,
    select: selectFields,
    filter: options.filter,
    format: format || 'json',
  };
  
  // Store for fallback access by printActionResult
  currentCommandContext = context;
  
  return context;
}

export function getCurrentCommandContext(): Partial<CommandContext> | undefined {
  return currentCommandContext;
}

export function printActionResult(result: AdapterActionResult, json: boolean, context?: Partial<CommandContext>): void {
  // Use provided context or fall back to current command context
  const effectiveContext = context || currentCommandContext || {};
  const outputFormat = effectiveContext.format || 'json';
  const hasFormatRequest = outputFormat !== 'json';
  
  // Apply filtering and selection if requested
  if (effectiveContext.select || effectiveContext.filter) {
    // Validate select fields first
    if (effectiveContext.select && result.data) {
      const validation = validateSelectFields(result.data, effectiveContext.select);
      if (!validation.valid) {
        throw new MikaCliError("INVALID_FIELD_SELECTION", `Field(s) not found in results: ${validation.missingFields?.join(", ")}`, {
          details: {
            requested_fields: effectiveContext.select,
            missing_fields: validation.missingFields,
          },
        });
      }
    }

    // Apply transforms to the data section
    if (result.data) {
      result.data = transformOutput(result.data, {
        select: effectiveContext.select,
        filter: effectiveContext.filter,
      }) as Record<string, unknown>;
    }
  }

  // If format transformation is requested, apply it and return (suppress normal metadata output)
  if (hasFormatRequest) {
    console.log(formatOutput(result.data || result, { format: outputFormat }));
    return;
  }

  // Otherwise, output as JSON or human-readable format
  if (json) {
    printJson(result);
    return;
  }

  console.log(result.message);

  if (result.user?.username) {
    console.log(`user: ${result.user.username}`);
  }

  if (result.id) {
    console.log(`id: ${result.id}`);
  }

  if (result.url) {
    console.log(`url: ${result.url}`);
  }

  if (result.sessionPath) {
    console.log(`session: ${result.sessionPath}`);
  }

  const meta = readResultMeta(result);
  if (meta && meta.count >= 0 && meta.listKey) {
    console.log(`${meta.listKey}: ${meta.count}`);
  }

  const login = readLoginMetadata(result);
  if (login) {
    console.log(`auth: ${formatAuthType(login.authType)}`);
    console.log(`validation: ${login.validation}`);

    if (login.source) {
      console.log(`source: ${formatLoginSource(login.source)}`);
    }

    if (login.reused) {
      console.log("reused: yes");
    }
  }

  const guidance = readGuidanceMetadata(result);
  if (guidance?.stability && guidance.stability !== "stable" && guidance.stability !== "unknown") {
    console.log(`support: ${guidance.stability}`);
  }

  const nextCommand = login?.recommendedNextCommand ?? guidance?.recommendedNextCommand;
  if (nextCommand) {
    console.log(`next: ${nextCommand}`);
  }
}

export async function runCommandAction<T>(input: {
  spinner: Ora | null;
  successMessage: string;
  action: () => Promise<T>;
  onSuccess: (result: T) => void;
  commandPath?: string;
}): Promise<void> {
  const startedAt = new Date();
  const commandPath = input.commandPath ?? currentCommandPath;

  try {
    if (input.spinner) {
      setInteractiveProgressHandler((message) => {
        input.spinner!.text = message;
      });
    }

    const result = await input.action();
    if (input.spinner) {
      const resultMessage = extractResultMessage(result);
      if (resultMessage && resultMessage === input.successMessage) {
        input.spinner.stop();
      } else {
        input.spinner.succeed(input.successMessage);
      }
    }
    await recordSuccessfulAction(result, {
      startedAt,
      finishedAt: new Date(),
      commandPath,
      fallbackMessage: input.successMessage,
    });
    input.onSuccess(result);
  } catch (error) {
    input.spinner?.stop();
    await recordFailedAction(error, {
      startedAt,
      finishedAt: new Date(),
      commandPath,
    });
    throw error;
  } finally {
    setInteractiveProgressHandler(null);
  }
}

function extractResultMessage<T>(result: T): string | undefined {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return undefined;
  }

  const message = (result as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

function buildCommanderCommandPath(command: Command): string {
  const segments: string[] = [];
  let current: Command | null = command;

  while (current) {
    const name = current.name();
    if (name) {
      segments.unshift(name);
    }
    current = current.parent ?? null;
  }

  return segments.join(" ");
}

async function recordSuccessfulAction<T>(
  result: T,
  input: {
    startedAt: Date;
    finishedAt: Date;
    commandPath?: string;
    fallbackMessage: string;
  },
): Promise<void> {
  const metadata = extractLoggableResult(result);

  await appendActionLog({
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    status: "success",
    command: buildActionLogCommandLabel({
      platform: metadata.platform,
      action: metadata.action,
      commandPath: input.commandPath,
    }),
    ...(input.commandPath ? { commandPath: input.commandPath } : {}),
    ...(metadata.platform ? { platform: metadata.platform } : {}),
    ...(metadata.account ? { account: metadata.account } : {}),
    ...(metadata.action ? { action: metadata.action } : {}),
    message: metadata.message ?? input.fallbackMessage,
    ...(metadata.resultId ? { resultId: metadata.resultId } : {}),
    ...(metadata.resultUrl ? { resultUrl: metadata.resultUrl } : {}),
    ...(metadata.user ? { user: metadata.user } : {}),
  }).catch(() => undefined);
}

async function recordFailedAction(
  error: unknown,
  input: {
    startedAt: Date;
    finishedAt: Date;
    commandPath?: string;
  },
): Promise<void> {
  const serialized = errorToJson(error);
  const details = isMikaCliError(error) ? error.details : undefined;

  await appendActionLog({
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    status: "failed",
    command: buildActionLogCommandLabel({
      platform: asString(details?.platform),
      action: asString(details?.action),
      commandPath: input.commandPath,
    }),
    ...(input.commandPath ? { commandPath: input.commandPath } : {}),
    ...(asString(details?.platform) ? { platform: asString(details?.platform)! } : {}),
    ...(asString(details?.account) ? { account: asString(details?.account)! } : {}),
    ...(asString(details?.action) ? { action: asString(details?.action)! } : {}),
    message: serialized.error.message,
    errorCode: serialized.error.code,
  }).catch(() => undefined);

  markActionLogCaptured(error);
}

function extractLoggableResult<T>(result: T): {
  platform?: string;
  account?: string;
  action?: string;
  message?: string;
  resultId?: string;
  resultUrl?: string;
  user?: string;
} {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {};
  }

  const value = result as Partial<AdapterActionResult>;
  return {
    ...(typeof value.platform === "string" ? { platform: value.platform } : {}),
    ...(typeof value.account === "string" ? { account: value.account } : {}),
    ...(typeof value.action === "string" ? { action: value.action } : {}),
    ...(typeof value.message === "string" ? { message: value.message } : {}),
    ...(typeof value.id === "string" ? { resultId: value.id } : {}),
    ...(typeof value.url === "string" ? { resultUrl: value.url } : {}),
    ...(value.user?.username || value.user?.displayName
      ? { user: value.user.username ?? value.user.displayName }
      : {}),
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readLoginMetadata(result: AdapterActionResult): {
  authType: string;
  validation: string;
  source?: string;
  reused: boolean;
  recommendedNextCommand?: string;
} | null {
  if (result.action !== "login") {
    return null;
  }

  const value = result.data?.login;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const login = value as {
    authType?: unknown;
    validation?: unknown;
    source?: unknown;
    reused?: unknown;
    recommendedNextCommand?: unknown;
  };

  if (typeof login.authType !== "string" || typeof login.validation !== "string") {
    return null;
  }

  return {
    authType: login.authType,
    validation: login.validation,
    ...(typeof login.source === "string" && login.source.length > 0 ? { source: login.source } : {}),
    reused: Boolean(login.reused),
    ...(typeof login.recommendedNextCommand === "string" && login.recommendedNextCommand.length > 0
      ? { recommendedNextCommand: login.recommendedNextCommand }
      : {}),
  };
}

function readGuidanceMetadata(result: AdapterActionResult): {
  recommendedNextCommand?: string;
  stability?: string;
} | null {
  const value = result.data?.guidance;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const guidance = value as {
    recommendedNextCommand?: unknown;
    stability?: unknown;
  };

  return {
    ...(typeof guidance.recommendedNextCommand === "string" && guidance.recommendedNextCommand.length > 0
      ? { recommendedNextCommand: guidance.recommendedNextCommand }
      : {}),
    ...(typeof guidance.stability === "string" && guidance.stability.length > 0 ? { stability: guidance.stability } : {}),
  };
}

function readResultMeta(result: AdapterActionResult): {
  listKey?: string;
  count: number;
} | null {
  const value = result.data?.meta;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const meta = value as {
    listKey?: unknown;
    count?: unknown;
  };

  if (typeof meta.count !== "number" || !Number.isFinite(meta.count)) {
    return null;
  }

  return {
    count: meta.count,
    ...(typeof meta.listKey === "string" && meta.listKey.length > 0 ? { listKey: meta.listKey } : {}),
  };
}

function formatAuthType(authType: string): string {
  switch (authType) {
    case "apiKey":
      return "api token";
    case "botToken":
      return "bot token";
    case "cookies":
      return "cookies";
    case "session":
      return "saved session";
    case "oauth2":
      return "oauth2";
    default:
      return authType;
  }
}

function formatLoginSource(source: string): string {
  switch (source) {
    case "cookie_string":
      return "cookie string";
    case "cookie_json":
      return "cookie json";
    case "cookies_txt":
      return "cookies.txt";
    case "bot_token":
      return "bot token";
    default:
      return source.replace(/_/gu, " ");
  }
}
