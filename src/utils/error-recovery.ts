import { errorToJson, isAutoCliError } from "../errors.js";
import { buildPlatformCommandPrefix } from "../core/runtime/platform-command-prefix.js";
import { getPlatformDefinition, getPlatformDefinitions } from "../platforms/index.js";

type SerializedCliError = ReturnType<typeof errorToJson> & {
  error: ReturnType<typeof errorToJson>["error"] & {
    hint?: string;
    nextCommand?: string;
  };
};

const BROWSER_RETRY_CODES = new Set([
  "X_AUTOMATION_BLOCKED",
  "GROK_ANTI_BOT_BLOCKED",
  "PERPLEXITY_ANTI_BOT_BLOCKED",
  "AMAZON_ANTI_BOT_BLOCKED",
]);

const BROWSER_REQUIRED_CODES = new Set([
  "BROWSER_ACTION_SHARED_REQUIRED",
  "BROWSER_NOT_RUNNING",
]);

const normalizedPlatformTokens = getPlatformDefinitions()
  .map((definition) => ({
    definition,
    token: definition.id.toUpperCase().replace(/[^A-Z0-9]+/gu, "_"),
  }))
  .sort((left, right) => right.token.length - left.token.length);

export function serializeCliError(error: unknown): SerializedCliError {
  const serialized = errorToJson(error) as SerializedCliError;
  const recovery = resolveErrorRecovery(error);

  if (recovery.hint) {
    serialized.error.hint = recovery.hint;
  }

  if (recovery.nextCommand) {
    serialized.error.nextCommand = recovery.nextCommand;
  }

  return serialized;
}

export function resolveErrorRecovery(error: unknown): {
  hint?: string;
  nextCommand?: string;
} {
  if (!isAutoCliError(error)) {
    return {};
  }

  const platform = resolvePlatformId(error);
  const loginCommand = platform ? buildProviderLoginCommand(platform) : undefined;

  if (error.code === "BROWSER_LOGIN_TIMEOUT") {
    return {
      hint: "Finish the sign-in flow before the timeout expires, or retry with a longer browser timeout.",
      nextCommand: loginCommand ? `${loginCommand} --browser-timeout 300` : "autocli login --browser --browser-timeout 300",
    };
  }

  if (BROWSER_REQUIRED_CODES.has(error.code)) {
    return {
      hint: "This action needs a live shared browser session for the provider before it can continue.",
      nextCommand: loginCommand ?? "autocli login --browser",
    };
  }

  if (error.code === "TOOLS_HTTP_SESSION_REQUIRED") {
    return {
      hint: "Save or refresh the provider session first, then retry the HTTP capture or replay.",
      nextCommand: loginCommand,
    };
  }

  if (isSessionRecoveryCode(error.code)) {
    return {
      hint: "Refresh or create the saved provider session, then retry the command.",
      nextCommand: loginCommand,
    };
  }

  if (BROWSER_RETRY_CODES.has(error.code)) {
    return {
      hint: "Retry the same command with `--browser` if this provider supports a browser-backed path.",
    };
  }

  if (error.code === "API_TOKEN_REQUIRED" || error.code === "BOT_TOKEN_REQUIRED" || error.code.endsWith("_TOKEN_INVALID")) {
    return {
      hint: "Re-run the provider login command to save a fresh token before retrying.",
      nextCommand: loginCommand,
    };
  }

  return {};
}

function isSessionRecoveryCode(code: string): boolean {
  return code === "SESSION_NOT_FOUND"
    || code === "SESSION_EXPIRED"
    || code === "SESSION_INVALID"
    || code.endsWith("_SESSION_EXPIRED")
    || code.endsWith("_SESSION_INVALID");
}

function resolvePlatformId(error: {
  code: string;
  details?: Record<string, unknown>;
}): string | undefined {
  const detailedPlatform = error.details?.platform;
  if (typeof detailedPlatform === "string" && getPlatformDefinition(detailedPlatform as never)) {
    return detailedPlatform;
  }

  for (const candidate of normalizedPlatformTokens) {
    if (error.code === candidate.token || error.code.startsWith(`${candidate.token}_`)) {
      return candidate.definition.id;
    }
  }

  return undefined;
}

function buildProviderLoginCommand(platformId: string): string | undefined {
  const definition = getPlatformDefinition(platformId as never);
  if (!definition) {
    return undefined;
  }

  return `${buildPlatformCommandPrefix(definition)} login`;
}
