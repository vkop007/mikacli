import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import { Command } from "commander";

import { IS_MIKACLI_STANDALONE } from "../build-flags.js";
import {
  MIMIKA_BROWSER_CONNECT_GRANT_ENV,
  MIMIKA_BROWSER_CONNECT_PLATFORM_ENV,
} from "../utils/mimika-browser-client.js";
import {
  PLATFORM_MANAGEMENT_ACTIONS,
  PlatformStateStore,
  assertPlatformRunnable,
  defaultPlatformState,
  managePlatform,
  summarizePlatformStates,
} from "../core/platform-state.js";
import { buildPlatformCommand } from "../core/runtime/build-platform-command.js";
import {
  HEALTH_ENDPOINT_PATH,
  MCP_ENDPOINT_PATH,
  MCP_PROTOCOL_VERSION,
  MIKA_MANAGEMENT_PROTOCOL_VERSION,
  MIKACLI_VERSION,
  getIntegrationMetadata,
} from "../integration-metadata.js";
import { getPlatformHomeUrl, isPlatform } from "../platforms/config.js";
import { getPlatformDefinition, getPlatformDefinitions } from "../platforms/index.js";

import type {
  PlatformAvailability,
  PlatformManagementAction,
  ResolvedPlatformState,
} from "../core/platform-state.js";
import type { PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { Command as CommanderCommand } from "commander";

/**
 * Expose MikaCLI over MCP without declaring one top-level tool per provider
 * capability. The provider catalog remains dynamic; clients discover a
 * provider, inspect its live command schema, and then execute it.
 */

export const DEFAULT_MCP_PORT = 8787;
export const DEFAULT_MCP_HOST = "127.0.0.1";
export const DEFAULT_RUN_TIMEOUT_MS = 20 * 60 * 1000;
export const DEFAULT_STATUS_TIMEOUT_MS = 60 * 1000;
export const MIMIKA_CONNECT_GRANT_HEADER = "X-Mimika-Connect-Grant";
export const MIMIKA_CONNECT_PLATFORM_HEADER = "X-Mimika-Connect-Platform";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CHILD_OUTPUT_BYTES = 10 * 1024 * 1024;
const CHILD_TERMINATION_GRACE_MS = 5_000;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type ToolRuntime = {
  cwd: string;
  runTimeoutMs: number;
  statusTimeoutMs: number;
  stateStore: PlatformStateStore;
  runCli: (argv: string[], options: {
    cwd: string;
    timeoutMs: number;
    environment?: Record<string, string>;
  }) => Promise<CliResult>;
};

export type BrowserConnectContext = {
  grant: string;
  platform: string;
};

export type McpServerOptions = {
  cwd?: string;
  runTimeoutMs?: number;
  statusTimeoutMs?: number;
  token?: string;
  stateStore?: PlatformStateStore;
  runCli?: ToolRuntime["runCli"];
};

// ---------------------------------------------------------------------------
// Catalog introspection
// ---------------------------------------------------------------------------

/** Every provider is reached through its category: `mikacli tools dns`, never `mikacli dns`. */
export function commandPath(definition: PlatformDefinition): string[] {
  return [definition.category, definition.id];
}

/** The metadata subcommand every platform gets for free is not a capability. */
export function isMetadataSubcommand(name: string): boolean {
  return name === "capabilities" || name === "caps";
}

function argumentSchema(command: CommanderCommand): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required = new Set<string>();
  const positional: string[] = [];

  for (const argument of command.registeredArguments ?? []) {
    positional.push(argument.name());
    if (argument.required) required.add("_");
  }
  if (positional.length > 0) {
    properties._ = {
      type: "array",
      items: { type: "string" },
      description: `Ordered positional arguments: ${positional.join(", ")}`,
    };
  }

  for (const option of command.options) {
    if (option.hidden) continue;
    const name = option.attributeName();
    if (name === "help") continue;
    properties[name] = {
      type: option.isBoolean() ? "boolean" : "string",
      description: option.description || `Option ${option.flags}`,
    };
    if (option.mandatory) required.add(name);
  }

  return {
    type: "object",
    properties,
    required: [...required],
    additionalProperties: false,
  };
}

export function describePlatform(
  definition: PlatformDefinition,
  state: ResolvedPlatformState = defaultPlatformState(definition.id),
  browserCapability?: string,
  browserArguments?: Record<string, unknown>,
): Record<string, unknown> {
  let built: CommanderCommand;
  try {
    built = buildPlatformCommand(definition);
  } catch (error) {
    return {
      platform: definition.id,
      state,
      error: `Could not build the command tree: ${errorMessage(error)}`,
      capabilities: [],
    };
  }

  const subcommands = built.commands.filter((sub) => !isMetadataSubcommand(sub.name()));
  const connectSpec = browserConnectSpec(definition, subcommands);
  const browserSpec = browserCapability
    ? browserActionSpec(definition, browserCapability, browserArguments, subcommands)
    : browserActionSpec(definition, undefined, browserArguments, subcommands);
  const invocation = subcommands.length > 0 ? "subcommand" : "direct";
  const base = {
    platform: definition.id,
    displayName: definition.displayName,
    category: definition.category,
    description: definition.description,
    authStrategies: definition.authStrategies,
    state,
    invocation,
    examples: definition.examples ?? [],
  };

  if (invocation === "direct") {
    return {
      ...base,
      callWith: "mika_run { platform, arguments } — omit `capability`",
      arguments: argumentSchema(built),
      ...(browserSpec ? { browserSpec } : {}),
      capabilities: [],
    };
  }

  return {
    ...base,
    callWith: "mika_run { platform, capability, arguments }",
    ...(connectSpec ? { connectSpec } : {}),
    ...(browserSpec ? { browserSpec } : {}),
    capabilities: subcommands.map((sub) => ({
      name: sub.name(),
      description: sub.description() || "",
      arguments: argumentSchema(sub),
    })),
  };
}

function browserActionSpec(
  definition: PlatformDefinition,
  capability: string | undefined,
  runArguments: Record<string, unknown> | undefined,
  subcommands: readonly CommanderCommand[],
): Record<string, unknown> | undefined {
  if (definition.id === "http" && capability === undefined) {
    const positional = Array.isArray(runArguments?._) ? runArguments._ : [];
    const target = typeof positional[0] === "string" ? positional[0].trim() : "";
    const operation = typeof positional[1] === "string" ? positional[1].trim().toLowerCase() : "";
    const needsBrowser = operation === "capture" || operation === "storage" ||
      (runArguments?.browser === true && ["inspect", "cookies", "request", "download", "graphql"].includes(operation));
    if (!needsBrowser) return undefined;
    const targetUrl = resolveHttpBrowserTarget(target);
    if (!targetUrl) return undefined;
    return {
      schemaVersion: 1,
      platform: definition.id,
      capability: "direct",
      // The scope description authorizes an origin, not a particular secret-
      // bearing URL. Keep paths and queries in the eventual mika_run request
      // only; they must not be reflected by mika_describe.
      targetUrl: `${targetUrl.origin}/`,
      allowedOrigin: targetUrl.origin,
    };
  }
  if (!capability || !subcommands.some((subcommand) => subcommand.name() === capability) || !isPlatform(definition.id)) {
    return undefined;
  }
  const root = getPlatformHomeUrl(definition.id);
  const target = (() => {
    if (definition.id === "youtube" && ["upload", "post"].includes(capability)) {
      return "https://studio.youtube.com/";
    }
    if (definition.id === "twitch" && capability === "update-stream") {
      return "https://dashboard.twitch.tv/";
    }
    if (definition.id === "reddit" && ["comment", "upvote", "save"].includes(capability)) {
      return "https://old.reddit.com/";
    }
    return root;
  })();
  const browserCapabilities: Record<string, readonly string[]> = {
    x: ["post", "like", "unlike", "comment", "delete"],
    facebook: ["post", "like", "comment"],
    instagram: ["delete", "delete-comment"],
    youtube: ["upload", "post", "delete", "comment"],
    twitch: ["follow", "unfollow", "create-clip", "update-stream"],
    reddit: ["post", "comment", "upvote", "save"],
    grok: ["text", "image", "video"],
    amazon: ["add-to-cart", "remove-from-cart", "update-cart", "cart", "orders", "order"],
    flipkart: ["update-cart", "remove-from-cart"],
  };
  if (!(browserCapabilities[definition.id]?.includes(capability))) return undefined;

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return undefined;
  }
  if (targetUrl.protocol !== "https:" || targetUrl.username || targetUrl.password) return undefined;
  targetUrl.hash = "";
  return {
    schemaVersion: 1,
    platform: definition.id,
    capability,
    targetUrl: targetUrl.href,
    allowedOrigin: targetUrl.origin,
  };
}

function resolveHttpBrowserTarget(raw: string): URL | undefined {
  if (!raw) return undefined;
  let value = raw;
  if (isPlatform(raw)) value = getPlatformHomeUrl(raw);
  else if (!/^https?:\/\//iu.test(raw) && raw.includes(".")) value = `https://${raw}`;
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return undefined;
  }
  if (target.protocol !== "https:" || target.username || target.password) return undefined;
  target.hash = "";
  return target;
}

function browserConnectSpec(
  definition: PlatformDefinition,
  subcommands: readonly CommanderCommand[],
): Record<string, unknown> | undefined {
  if (!subcommands.some((subcommand) => subcommand.name() === "login")) return undefined;
  // Cookie capture and Google's loopback OAuth consent are the only login
  // paths that invoke the managed browser. API keys, bot tokens, and
  // terminal-native sessions must never receive a browser grant merely because
  // their command happens to be named `login`.
  const usesCookieBrowser = definition.authStrategies.includes("cookies");
  const usesGoogleOAuthBrowser = definition.category === "google" && definition.authStrategies.includes("oauth2");
  if (!usesCookieBrowser && !usesGoogleOAuthBrowser) return undefined;
  if (!isPlatform(definition.id)) return undefined;

  let loginUrl: URL;
  try {
    loginUrl = new URL(usesGoogleOAuthBrowser ? "https://accounts.google.com/" : getPlatformHomeUrl(definition.id));
  } catch {
    return undefined;
  }
  if (loginUrl.protocol !== "https:" || loginUrl.username || loginUrl.password) return undefined;
  loginUrl.hash = "";
  return {
    schemaVersion: 1,
    platform: definition.id,
    capability: "login",
    loginUrl: loginUrl.href,
    allowedOrigins: [loginUrl.origin],
  };
}

export function listPlatforms(
  category?: string,
  auth?: string,
  states?: readonly ResolvedPlatformState[],
  status?: PlatformAvailability,
): Record<string, unknown> {
  const all = getPlatformDefinitions();
  const byPlatform = new Map(
    (states ?? all.map((definition) => defaultPlatformState(definition.id)))
      .map((state) => [state.platform, state]),
  );
  const filtered = all.filter((definition) => {
    if (category && definition.category !== category) return false;
    if (auth && !definition.authStrategies.includes(auth as never)) return false;
    if (status && byPlatform.get(definition.id)?.status !== status) return false;
    return true;
  });
  const filteredStates = filtered.map((definition) => byPlatform.get(definition.id)!);

  return {
    total: filtered.length,
    summary: summarizePlatformStates(filteredStates),
    catalog: getIntegrationMetadata(all.length).catalog,
    platforms: filtered.map((definition) => {
      const state = byPlatform.get(definition.id)!;
      return {
        platform: definition.id,
        displayName: definition.displayName,
        category: definition.category,
        auth: definition.authStrategies,
        needsCredential: !definition.authStrategies.includes("none" as never),
        description: definition.description,
        installed: state.installed,
        enabled: state.enabled,
        status: state.status,
        source: state.source,
        configured: state.configured,
        ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/** Turn a JSON argument object back into the flags Commander expects. */
export function toCliArguments(args: Record<string, unknown> | undefined): string[] {
  if (!args) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    if (key === "_") {
      for (const positional of Array.isArray(value) ? value : [value]) {
        out.push(String(positional));
      }
      continue;
    }
    const flag = `--${key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
    if (typeof value === "boolean") {
      if (value) out.push(flag);
      continue;
    }
    out.push(flag, String(value));
  }
  return out;
}

function cliEntryPoint(): { command: string; leading: string[] } {
  if (IS_MIKACLI_STANDALONE) {
    return { command: process.execPath, leading: [] };
  }
  const entry = process.argv[1];
  return { command: process.execPath, leading: entry ? [resolve(entry)] : [] };
}

async function runCliProcess(
  argv: string[],
  options: { cwd: string; timeoutMs: number; environment?: Record<string, string> },
): Promise<CliResult> {
  const { command, leading } = cliEntryPoint();
  const environment = buildChildEnvironment(options.environment);
  return new Promise((resolveResult) => {
    const child = spawn(command, [...leading, ...argv], {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: environment,
    });

    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let timedOut = false;
    let outputExceeded = false;
    let forceTimer: NodeJS.Timeout | undefined;

    const terminate = (): void => {
      child.kill("SIGTERM");
      forceTimer = setTimeout(() => child.kill("SIGKILL"), CHILD_TERMINATION_GRACE_MS);
      forceTimer.unref?.();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, options.timeoutMs);
    timer.unref?.();

    const append = (target: "stdout" | "stderr", chunk: unknown): void => {
      const text = String(chunk);
      outputBytes += Buffer.byteLength(text);
      if (outputBytes > MAX_CHILD_OUTPUT_BYTES) {
        outputExceeded = true;
        terminate();
        return;
      }
      if (target === "stdout") stdout += text;
      else stderr += text;
    };

    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      resolveResult({ code: 127, stdout, stderr: `${stderr}${errorMessage(error)}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      if (timedOut) {
        resolveResult({
          code: 124,
          stdout,
          stderr: `${stderr}${stderr ? "\n" : ""}Timed out after ${options.timeoutMs}ms.`,
        });
        return;
      }
      if (outputExceeded) {
        resolveResult({
          code: 125,
          stdout,
          stderr: `${stderr}${stderr ? "\n" : ""}Output exceeded ${MAX_CHILD_OUTPUT_BYTES} bytes.`,
        });
        return;
      }
      resolveResult({ code: code ?? 0, stdout, stderr });
    });
  });
}

export function buildChildEnvironment(overrides?: Record<string, string>): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment[MIMIKA_BROWSER_CONNECT_GRANT_ENV];
  delete environment[MIMIKA_BROWSER_CONNECT_PLATFORM_ENV];
  for (const [name, value] of Object.entries(overrides ?? {})) environment[name] = value;
  return environment;
}

function createToolRuntime(options: McpServerOptions = {}): ToolRuntime {
  return {
    cwd: resolve(options.cwd ?? process.cwd()),
    runTimeoutMs: options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS,
    statusTimeoutMs: options.statusTimeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS,
    stateStore: options.stateStore ?? new PlatformStateStore(),
    runCli: options.runCli ?? runCliProcess,
  };
}

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

function jsonResult(value: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  options: McpServerOptions = {},
  connectContext?: BrowserConnectContext,
): Promise<ToolResult> {
  const runtime = createToolRuntime(options);
  const definitions = getPlatformDefinitions();
  if (connectContext && name !== "mika_run") {
    return textResult("Browser connect authorization is valid only for mika_run login.", true);
  }

  switch (name) {
    case "mika_list_platforms": {
      const invalid = unknownArgument(args, ["category", "auth", "status"]);
      if (invalid) return textResult(invalid, true);
      const status = parsePlatformStatus(args.status);
      if (args.status !== undefined && !status) {
        return textResult("`status` must be enabled, disabled, or uninstalled.", true);
      }
      const states = await runtime.stateStore.list(definitions.map((definition) => definition.id));
      return jsonResult(
        listPlatforms(
          optionalString(args.category),
          optionalString(args.auth),
          states,
          status,
        ),
      );
    }

    case "mika_describe": {
      const invalid = unknownArgument(args, ["platform", "capability", "arguments"]);
      if (invalid) return textResult(invalid, true);
      const platform = requiredString(args.platform);
      const capability = optionalString(args.capability);
      if (args.arguments !== undefined && !isRecord(args.arguments)) {
        return textResult("mika_describe `arguments` must be an object.", true);
      }
      if (!platform) return textResult("mika_describe needs a `platform`.", true);
      const definition = getPlatformDefinition(platform as never);
      if (!definition) {
        return textResult(
          `No platform named "${platform}". Call mika_list_platforms to see what exists.`,
          true,
        );
      }
      return jsonResult(describePlatform(
        definition,
        await runtime.stateStore.get(platform),
        capability,
        args.arguments as Record<string, unknown> | undefined,
      ));
    }

    case "mika_auth_status": {
      const invalid = unknownArgument(args, ["platform", "refresh"]);
      if (invalid) return textResult(invalid, true);
      const platform = optionalString(args.platform);
      if (platform && !getPlatformDefinition(platform as never)) {
        return textResult(`No platform named "${platform}".`, true);
      }
      if (args.refresh !== undefined && typeof args.refresh !== "boolean") {
        return textResult("mika_auth_status `refresh` must be a boolean.", true);
      }
      const result = await runtime.runCli([
        "status",
        ...(args.refresh === true ? ["--refresh"] : []),
        "--json",
      ], {
        cwd: runtime.cwd,
        timeoutMs: runtime.statusTimeoutMs,
      });
      if (result.code !== 0 && !result.stdout.trim()) {
        return textResult(result.stderr.trim() || "mikacli status failed.", true);
      }

      const parsed = parseJsonObject(result.stdout);
      if (!parsed) return textResult(result.stdout.trim() || result.stderr.trim());
      if (platform) {
        filterStatusEntries(parsed, platform);
        parsed.platformState = await runtime.stateStore.get(platform);
      } else {
        const states = await runtime.stateStore.list(definitions.map((definition) => definition.id));
        parsed.platformStateSummary = summarizePlatformStates(states);
      }
      return jsonResult(parsed);
    }

    case "mika_run": {
      const invalid = unknownArgument(args, ["platform", "capability", "arguments"]);
      if (invalid) return textResult(invalid, true);
      const platform = requiredString(args.platform);
      const capability = optionalString(args.capability);
      if (!platform) return textResult("mika_run needs a `platform`.", true);
      const definition = getPlatformDefinition(platform as never);
      if (!definition) return textResult(`No platform named "${platform}".`, true);
      if (args.arguments !== undefined && !isRecord(args.arguments)) {
        return textResult("mika_run `arguments` must be an object.", true);
      }

      const built = buildPlatformCommand(definition);
      const capabilities = built.commands.filter((command) => !isMetadataSubcommand(command.name()));
      if (capabilities.length === 0 && capability) {
        return textResult(`Platform "${platform}" is invoked directly; omit \`capability\`.`, true);
      }
      if (capabilities.length > 0 && !capability) {
        return textResult(`Platform "${platform}" needs a \`capability\`. Call mika_describe first.`, true);
      }
      if (capability && !capabilities.some((command) => command.name() === capability)) {
        return textResult(`Platform "${platform}" has no capability named "${capability}".`, true);
      }
      if (connectContext && (platform !== connectContext.platform || !isPlatform(platform))) {
        return textResult("Browser authorization does not match this platform request.", true);
      }

      try {
        await assertPlatformRunnable(platform, runtime.stateStore);
      } catch (error) {
        return textResult(errorMessage(error), true);
      }

      const argv = [
        ...commandPath(definition),
        ...(capability ? [capability] : []),
        ...toCliArguments(args.arguments as Record<string, unknown> | undefined),
        "--json",
      ];
      const result = await runtime.runCli(argv, {
        cwd: runtime.cwd,
        timeoutMs: runtime.runTimeoutMs,
        ...(connectContext ? {
          environment: {
            [MIMIKA_BROWSER_CONNECT_GRANT_ENV]: connectContext.grant,
            [MIMIKA_BROWSER_CONNECT_PLATFORM_ENV]: connectContext.platform,
          },
        } : {}),
      });
      if (result.code !== 0) {
        return textResult(
          result.stdout.trim() || result.stderr.trim() || `mikacli exited with code ${result.code}.`,
          true,
        );
      }
      const parsed = parseJsonObject(result.stdout);
      return parsed ? jsonResult(parsed) : textResult(result.stdout.trim() || "(no output)");
    }

    case "mika_manage_platform": {
      const invalid = unknownArgument(args, ["action", "platform", "preserve_auth"]);
      if (invalid) return textResult(invalid, true);
      const action = optionalString(args.action);
      const platform = requiredString(args.platform);
      if (!isPlatformManagementAction(action)) {
        return textResult("`action` must be install, enable, disable, or uninstall.", true);
      }
      if (!platform || !isPlatform(platform)) {
        return textResult(`No platform named "${platform ?? ""}".`, true);
      }
      if (args.preserve_auth !== undefined && typeof args.preserve_auth !== "boolean") {
        return textResult("`preserve_auth` must be a boolean.", true);
      }
      try {
        const result = await managePlatform(runtime.stateStore, platform, action, {
          preserveAuth: typeof args.preserve_auth === "boolean" ? args.preserve_auth : true,
        });
        return jsonResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        return textResult(errorMessage(error), true);
      }
    }

    default:
      return textResult(`Unknown tool "${name}".`, true);
  }
}

// ---------------------------------------------------------------------------
// Tool declarations
// ---------------------------------------------------------------------------

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const PLATFORM_STATE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    platform: { type: "string" },
    installed: { type: "boolean" },
    enabled: { type: "boolean" },
    status: { type: "string", enum: ["enabled", "disabled", "uninstalled"] },
    source: { type: "string", const: "bundled" },
    configured: { type: "boolean" },
    updatedAt: { type: "string" },
  },
  required: ["platform", "installed", "enabled", "status", "source", "configured"],
  additionalProperties: false,
} as const;

const STATE_SUMMARY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    total: { type: "number" },
    installed: { type: "number" },
    enabled: { type: "number" },
    disabled: { type: "number" },
    uninstalled: { type: "number" },
  },
  required: ["total", "installed", "enabled", "disabled", "uninstalled"],
  additionalProperties: false,
} as const;

export const TOOLS = [
  {
    name: "mika_list_platforms",
    title: "List MikaCLI platforms",
    description:
      "List the dynamic MikaCLI platform catalog and each platform's installed/enabled state. Start here; platforms whose auth is `none` need no sign-in.",
    annotations: READ_ONLY_ANNOTATIONS,
    outputSchema: {
      type: "object",
      properties: {
        total: { type: "number" },
        summary: STATE_SUMMARY_OUTPUT_SCHEMA,
        catalog: { type: "object", additionalProperties: true },
        platforms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              platform: { type: "string" },
              displayName: { type: "string" },
              category: { type: "string" },
              auth: { type: "array", items: { type: "string" } },
              needsCredential: { type: "boolean" },
              description: { type: "string" },
              installed: { type: "boolean" },
              enabled: { type: "boolean" },
              status: { type: "string", enum: ["enabled", "disabled", "uninstalled"] },
              source: { type: "string", const: "bundled" },
              configured: { type: "boolean" },
              updatedAt: { type: "string" },
            },
            required: [
              "platform", "displayName", "category", "auth", "needsCredential", "description",
              "installed", "enabled", "status", "source", "configured",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["total", "summary", "catalog", "platforms"],
      additionalProperties: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter." },
        auth: { type: "string", description: "Optional auth-strategy filter." },
        status: {
          type: "string",
          enum: ["enabled", "disabled", "uninstalled"],
          description: "Optional persistent availability-state filter.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "mika_describe",
    title: "Describe a MikaCLI platform",
    description:
      "Show one platform's live capabilities, argument schemas, invocation shape, and installed/enabled state. Read this before mika_run.",
    annotations: READ_ONLY_ANNOTATIONS,
    outputSchema: { type: "object", additionalProperties: true },
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", minLength: 1, description: "Platform id from mika_list_platforms." },
        capability: {
          type: "string",
          minLength: 1,
          description: "Optional capability whose exact managed-browser origin should be described.",
        },
        arguments: {
          type: "object",
          description: "Optional pending mika_run arguments used only to derive an exact browser origin for direct providers.",
          additionalProperties: true,
        },
      },
      required: ["platform"],
      additionalProperties: false,
    },
  },
  {
    name: "mika_auth_status",
    title: "Check MikaCLI authentication",
    description:
      "Report saved session state and persistent platform availability. Use it before a capability that needs credentials.",
    annotations: READ_ONLY_ANNOTATIONS,
    outputSchema: { type: "object", additionalProperties: true },
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", minLength: 1, description: "Optional platform id." },
        refresh: {
          type: "boolean",
          default: false,
          description: "Actively validate saved sessions before returning status.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "mika_run",
    title: "Run a MikaCLI capability",
    description:
      "Run one dynamic provider capability. Call mika_describe first. Direct-invocation platforms omit capability; positional arguments go in `arguments._`.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", minLength: 1, description: "Platform id." },
        capability: {
          type: "string",
          minLength: 1,
          description: "Capability from mika_describe; omit for direct-invocation platforms.",
        },
        arguments: {
          type: "object",
          description: "Named arguments, plus `_` for ordered positional arguments.",
          additionalProperties: true,
        },
      },
      required: ["platform"],
      additionalProperties: false,
    },
  },
  {
    name: "mika_manage_platform",
    title: "Manage a MikaCLI platform",
    description:
      "Install, enable, disable, or uninstall one bundled platform. The host must obtain user confirmation before calling this management tool. Auth is preserved by default.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: {
      "io.mikacli/managementProtocol": MIKA_MANAGEMENT_PROTOCOL_VERSION,
      "io.mikacli/confirmation": "required",
    },
    outputSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean", const: true },
        action: { type: "string", enum: PLATFORM_MANAGEMENT_ACTIONS },
        platform: { type: "string" },
        changed: { type: "boolean" },
        state: PLATFORM_STATE_OUTPUT_SCHEMA,
        preserveAuth: { type: "boolean" },
        removedAuthPaths: { type: "array", items: { type: "string" } },
      },
      required: ["ok", "action", "platform", "changed", "state", "preserveAuth", "removedAuthPaths"],
      additionalProperties: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: PLATFORM_MANAGEMENT_ACTIONS,
          description: "Requested persistent state transition.",
        },
        platform: { type: "string", minLength: 1, description: "Platform id." },
        preserve_auth: {
          type: "boolean",
          default: true,
          description: "Keep saved sessions and token connections when uninstalling.",
        },
      },
      required: ["action", "platform"],
      additionalProperties: false,
    },
  },
] as const;

// ---------------------------------------------------------------------------
// JSON-RPC / HTTP
// ---------------------------------------------------------------------------

export async function handleRpc(
  request: unknown,
  options: McpServerOptions = {},
  connectContext?: BrowserConnectContext,
): Promise<Record<string, unknown> | undefined> {
  if (!isJsonRpcRequest(request)) {
    return rpcError(null, -32600, "Invalid Request");
  }

  const { method, id, params } = request;
  const notification = !("id" in request);
  let response: Record<string, unknown>;

  switch (method) {
    case "initialize":
      response = rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "mikacli", version: MIKACLI_VERSION },
        instructions:
          "Discover providers with mika_list_platforms, inspect one with mika_describe, and obtain user confirmation before mika_manage_platform.",
        _meta: { "io.mikacli/integration": getIntegrationMetadata(getPlatformDefinitions().length) },
      });
      break;

    case "notifications/initialized":
    case "notifications/cancelled":
      return undefined;

    case "tools/list":
      response = rpcResult(id, {
        tools: TOOLS,
        _meta: { "io.mikacli/catalogRevision": MIKACLI_VERSION },
      });
      break;

    case "tools/call": {
      const name = typeof params?.name === "string" ? params.name : "";
      const args = isRecord(params?.arguments) ? params.arguments : {};
      if (!name) {
        response = rpcError(id ?? null, -32602, "tools/call requires a tool name.");
        break;
      }
      try {
        response = rpcResult(id, await callTool(name, args, options, connectContext));
      } catch (error) {
        response = rpcResult(id, textResult(`MikaCLI failed to run ${name}: ${errorMessage(error)}`, true));
      }
      break;
    }

    case "ping":
      response = rpcResult(id, {});
      break;

    default:
      response = rpcError(id ?? null, -32601, `Method not found: ${method}`);
  }

  return notification ? undefined : response;
}

async function handleRpcPayload(
  payload: unknown,
  options: McpServerOptions,
  connectContext?: BrowserConnectContext,
): Promise<unknown | undefined> {
  if (!Array.isArray(payload)) return handleRpc(payload, options, connectContext);
  if (payload.length === 0) return rpcError(null, -32600, "Invalid Request");
  if (connectContext) return rpcError(null, -32602, "Browser authorization cannot be used with an MCP batch.");
  const responses = (await Promise.all(payload.map((request) => handleRpc(request, options))))
    .filter((response): response is Record<string, unknown> => Boolean(response));
  return responses.length > 0 ? responses : undefined;
}

export function createMcpHttpServer(options: McpServerOptions = {}): Server {
  const startedAt = Date.now();
  const runtimeOptions = {
    ...options,
    cwd: resolve(options.cwd ?? process.cwd()),
    stateStore: options.stateStore ?? new PlatformStateStore(),
  };

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = requestPath(req);

    if ((req.method === "GET" || req.method === "HEAD") && path === HEALTH_ENDPOINT_PATH) {
      const body = {
        ok: true,
        status: "healthy",
        uptimeMs: Date.now() - startedAt,
        ...getIntegrationMetadata(getPlatformDefinitions().length),
      };
      writeJson(res, 200, body, req.method === "HEAD");
      return;
    }

    if (path !== MCP_ENDPOINT_PATH && path !== "/") {
      writeJson(res, 404, { error: "not_found" });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      writeJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    if (!isAuthorized(req, options.token)) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="mikacli"');
      writeJson(res, 401, { error: "invalid_token" });
      return;
    }
    if (!String(req.headers["content-type"] ?? "").toLowerCase().includes("application/json")) {
      writeJson(res, 415, { error: "content_type_must_be_application_json" });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (error) {
      const status = error instanceof HttpInputError ? error.status : 400;
      writeJson(res, status, rpcError(null, -32700, errorMessage(error)));
      return;
    }

    const connectAuthorization = browserConnectAuthorization(req, payload);
    if (connectAuthorization.error) {
      const id = isJsonRpcRequest(payload) ? payload.id ?? null : null;
      writeJson(res, 400, rpcError(id, -32602, connectAuthorization.error));
      return;
    }

    const response = await handleRpcPayload(payload, runtimeOptions, connectAuthorization.context);
    if (response === undefined) {
      res.writeHead(202, commonHeaders());
      res.end();
      return;
    }
    writeJson(res, 200, response);
  });
}

function browserConnectAuthorization(
  request: IncomingMessage,
  payload: unknown,
): { context?: BrowserConnectContext; error?: string } {
  const grants = rawHeaderValues(request, MIMIKA_CONNECT_GRANT_HEADER);
  const platforms = rawHeaderValues(request, MIMIKA_CONNECT_PLATFORM_HEADER);
  if (grants.length === 0 && platforms.length === 0) return {};
  const invalid = (): { error: string } => ({
    error: "Invalid request-scoped Mimika browser authorization.",
  });
  if (grants.length !== 1 || platforms.length !== 1 || Array.isArray(payload)) return invalid();

  const grant = grants[0]!.trim();
  const platform = platforms[0]!.trim();
  if (!/^[0-9a-f]{64}$/u.test(grant) || !isPlatform(platform) || !isJsonRpcRequest(payload)) return invalid();
  if (payload.method !== "tools/call" || !isRecord(payload.params) || payload.params.name !== "mika_run") return invalid();
  const args = isRecord(payload.params.arguments) ? payload.params.arguments : undefined;
  if (!args || args.platform !== platform ||
    (args.capability !== undefined && typeof args.capability !== "string")) return invalid();
  return { context: { grant, platform } };
}

function rawHeaderValues(request: IncomingMessage, expectedName: string): string[] {
  const values: string[] = [];
  for (let index = 0; index + 1 < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]!.toLowerCase() === expectedName.toLowerCase()) {
      values.push(request.rawHeaders[index + 1] ?? "");
    }
  }
  return values;
}

export async function startMcpHttpServer(
  host: string,
  port: number,
  options: McpServerOptions = {},
): Promise<Server> {
  const server = createMcpHttpServer(options);
  await listenOnce(server, host, port);
  return server;
}

export function createServeCommand(): Command {
  return new Command("serve")
    .description("Run MikaCLI as a local MCP server")
    .option("--mcp", "Serve the Model Context Protocol (currently the only mode)", true)
    .option("--port <port>", `Port to bind (default ${DEFAULT_MCP_PORT})`, String(DEFAULT_MCP_PORT))
    .option("--host <host>", `Interface to bind (default ${DEFAULT_MCP_HOST})`, DEFAULT_MCP_HOST)
    .option("--token <token>", "Require this bearer token on MCP requests")
    .option("--cwd <path>", "Working directory for provider commands", process.cwd())
    .option(
      "--run-timeout-seconds <seconds>",
      "Maximum provider run time (default 1200 seconds)",
      String(DEFAULT_RUN_TIMEOUT_MS / 1000),
    )
    .addHelpText(
      "after",
      `
Endpoints:
  MCP:    http://${DEFAULT_MCP_HOST}:${DEFAULT_MCP_PORT}${MCP_ENDPOINT_PATH}
  Health: http://${DEFAULT_MCP_HOST}:${DEFAULT_MCP_PORT}${HEALTH_ENDPOINT_PATH}

Examples:
  mikacli serve --mcp
  mikacli serve --mcp --port 8790 --cwd /absolute/workspace
  mikacli serve --mcp --token "$(openssl rand -hex 16)"
`,
    )
    .action(async function serveAction(this: Command) {
      const options = this.optsWithGlobals<{
        port?: string;
        host?: string;
        token?: string;
        cwd?: string;
        runTimeoutSeconds?: string;
      }>();
      const port = parseInteger(options.port, DEFAULT_MCP_PORT, "port", 1, 65_535);
      const runTimeoutSeconds = parseInteger(
        options.runTimeoutSeconds,
        DEFAULT_RUN_TIMEOUT_MS / 1000,
        "run timeout",
        1,
        7_200,
      );
      const host = options.host ?? DEFAULT_MCP_HOST;
      if (!isLoopbackHost(host) && !options.token) {
        throw new Error(`Refusing to bind ${host} without --token. Use a loopback host, or pass a token.`);
      }
      const cwd = resolve(options.cwd ?? process.cwd());
      const cwdStat = await stat(cwd).catch(() => undefined);
      if (!cwdStat?.isDirectory()) {
        throw new Error(`Working directory does not exist or is not a directory: ${cwd}`);
      }

      const server = await startMcpHttpServer(host, port, {
        cwd,
        token: options.token,
        runTimeoutMs: runTimeoutSeconds * 1000,
      });
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      process.stderr.write(`MikaCLI MCP server listening on http://${host}:${actualPort}${MCP_ENDPOINT_PATH}\n`);
      process.stderr.write(`  health: http://${host}:${actualPort}${HEALTH_ENDPOINT_PATH}\n`);
      process.stderr.write(`  tools: ${TOOLS.map((tool) => tool.name).join(", ")}\n`);
      process.stderr.write(`  platforms: ${getPlatformDefinitions().length}\n`);
      process.stderr.write(`  cwd: ${cwd}\n`);
      if (options.token) process.stderr.write("  auth: bearer token required\n");
      await waitForServerShutdown(server);
    });
}

function parsePlatformStatus(value: unknown): PlatformAvailability | undefined {
  return value === "enabled" || value === "disabled" || value === "uninstalled" ? value : undefined;
}

function isPlatformManagementAction(value: string | undefined): value is PlatformManagementAction {
  return Boolean(value) && PLATFORM_MANAGEMENT_ACTIONS.includes(value as PlatformManagementAction);
}

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredString(value);
}

function unknownArgument(args: Record<string, unknown>, allowed: readonly string[]): string | undefined {
  const unknown = Object.keys(args).find((key) => !allowed.includes(key));
  return unknown ? `Unknown argument \`${unknown}\`.` : undefined;
}

function filterStatusEntries(payload: Record<string, unknown>, platform: string): void {
  for (const key of ["sessions", "entries"]) {
    if (Array.isArray(payload[key])) {
      payload[key] = payload[key].filter(
        (entry) => isRecord(entry) && entry.platform === platform,
      );
    }
  }
}

function parseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return isRecord(value)
    && value.jsonrpc === "2.0"
    && typeof value.method === "string"
    && (value.params === undefined || isRecord(value.params))
    && (
      value.id === undefined
      || value.id === null
      || typeof value.id === "string"
      || (typeof value.id === "number" && Number.isFinite(value.id))
    );
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown): Record<string, unknown> {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk: Buffer | string) => {
      if (failed) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        reject(new HttpInputError(413, `Request body exceeds ${MAX_BODY_BYTES} bytes.`));
        req.resume();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (!failed) resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function requestPath(req: IncomingMessage): string {
  try {
    return new URL(req.url ?? "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function isAuthorized(req: IncomingMessage, token: string | undefined): boolean {
  if (!token) return true;
  const authorization = String(req.headers.authorization ?? "");
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] === token;
}

function writeJson(res: ServerResponse, status: number, body: unknown, headOnly = false): void {
  res.writeHead(status, commonHeaders());
  res.end(headOnly ? undefined : JSON.stringify(body));
}

function commonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function listenOnce(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolveListen();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid ${label}: ${value ?? fallback}. Expected ${minimum}-${maximum}.`);
  }
  return parsed;
}

async function waitForServerShutdown(server: Server): Promise<void> {
  await new Promise<void>((resolveShutdown, reject) => {
    let closing = false;
    const close = (): void => {
      if (closing) return;
      closing = true;
      server.close((error) => error ? reject(error) : resolveShutdown());
    };
    const cleanup = (): void => {
      process.off("SIGINT", close);
      process.off("SIGTERM", close);
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    server.once("close", cleanup);
    server.once("error", reject);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

class HttpInputError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
