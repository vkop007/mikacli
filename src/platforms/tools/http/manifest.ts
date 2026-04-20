import { Command } from "commander";

import { buildExamplesHelpText } from "../../../core/runtime/example-help.js";
import { normalizeActionResult } from "../../../core/runtime/login-result.js";
import { Logger } from "../../../logger.js";
import { resolveCommandContext, runCommandAction } from "../../../utils/cli.js";
import { MikaCliError } from "../../../errors.js";
import { printSessionHttpResult } from "./output.js";
import { sessionHttpAdapter } from "./adapter.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli tools http github inspect",
  "mikacli tools http github cookies",
  "mikacli tools http github storage",
  "mikacli tools http github.com capture --browser-timeout 60",
  "mikacli tools http github.com capture --summary --group-by endpoint --browser-timeout 60",
  "mikacli tools http github request GET /settings/profile",
  "mikacli tools http github download /settings/profile --output ./tmp/github-profile.html",
  "mikacli tools http github graphql '{ viewer { login } }' --path /api/graphql",
  "mikacli tools http your-workspace.atlassian.net request GET /rest/api/3/myself --platform jira",
  "mikacli tools http github request POST /session --json-body '{\"ok\":true}' --browser",
] as const;

function buildHttpCommand(options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("http").description("Inspect, capture, and replay authenticated HTTP traffic with saved MikaCLI sessions");
  command
    .argument("<target>", "Provider name, domain, or full URL")
    .argument("<operation>", "inspect, capture, or request")
    .argument("[args...]", "Extra args, such as METHOD and path for request")
    .option("--platform <provider>", "Force a provider when a domain matches multiple cookie-backed platforms")
    .option("--account <name>", "Saved session account to use")
    .option("--browser", "Borrow cookies from the shared MikaCLI browser profile instead of a saved session")
    .option("--browser-timeout <seconds>", "Browser wait timeout in seconds", (value) => Number.parseInt(value, 10), 60)
    .option("--limit <number>", "Capture result limit (default: 25)", (value) => Number.parseInt(value, 10), 25)
    .option("--filter <text>", "Only include captured requests whose URL contains this text")
    .option("--summary", "Summarize captured requests into likely useful endpoint groups")
    .option("--group-by <mode>", "Capture summary grouping: endpoint, full-url, method, or status", "endpoint")
    .option("--timeout <ms>", "Request timeout in milliseconds", (value) => Number.parseInt(value, 10), 20000)
    .option("--header <header>", "Request header in 'Name: value' form", collectOptionValues, [])
    .option("--body <text>", "Raw request body for request")
    .option("--json-body <json>", "JSON request body for request")
    .option("--output <path>", "Output file path for download")
    .option("--query <text>", "GraphQL query text")
    .option("--variables <json>", "GraphQL variables JSON")
    .option("--operation-name <name>", "GraphQL operation name")
    .option("--path <path>", "Relative path or full URL for graphql/download request targets")
    .addHelpText("after", [
      "",
      "Operations:",
      "  inspect   Show saved session and optional shared-browser details for the target",
      "  cookies   Show matched cookies for the saved session or shared browser profile",
      "  storage   Show matched localStorage and sessionStorage keys from the shared browser profile",
      "  capture   Attach to the shared browser profile and record matching network requests",
      "  request   Perform an authenticated request: request <METHOD> <path-or-url>",
      "  download  Download an authenticated response to a file: download <path-or-url> --output <path>",
      "  graphql   Send a GraphQL POST request using the saved session or shared browser cookies",
    ].join("\n"))
    .addHelpText("afterAll", buildExamplesHelpText(EXAMPLES, options));

  command.action(async (
    target: string,
    operation: string,
    args: string[],
    input: {
      platform?: string;
      account?: string;
      browser?: boolean;
      browserTimeout: number;
      limit: number;
      filter?: string;
      summary?: boolean;
      groupBy?: string;
      timeout: number;
      header: string[];
      body?: string;
      jsonBody?: string;
      output?: string;
      query?: string;
      variables?: string;
      operationName?: string;
      path?: string;
    },
    cmd: Command,
  ) => {
    await runHttpAction(cmd, operation, () => {
      switch (operation.trim().toLowerCase()) {
        case "inspect":
          return sessionHttpAdapter.inspect({
            target,
            account: input.account,
            platform: input.platform,
            browser: input.browser,
            browserTimeoutSeconds: input.browserTimeout,
          });
        case "cookies":
          return sessionHttpAdapter.cookies({
            target,
            account: input.account,
            platform: input.platform,
            browser: input.browser,
            browserTimeoutSeconds: input.browserTimeout,
          });
        case "storage":
          return sessionHttpAdapter.storage({
            target,
            account: input.account,
            platform: input.platform,
            browserTimeoutSeconds: input.browserTimeout,
          });
        case "capture":
          return sessionHttpAdapter.capture({
            target,
            account: input.account,
            platform: input.platform,
            browserTimeoutSeconds: input.browserTimeout,
            limit: input.limit,
            filter: input.filter,
            summary: input.summary,
            groupBy: input.groupBy as "endpoint" | "full-url" | "method" | "status" | undefined,
          });
        case "request": {
          const [method, pathOrUrl] = args;
          if (!method || !pathOrUrl) {
            throw new MikaCliError("TOOLS_HTTP_REQUEST_ARGUMENTS_REQUIRED", "Use: mikacli tools http <target> request <METHOD> <path-or-url>.");
          }

          return sessionHttpAdapter.request({
            target,
            method,
            pathOrUrl,
            account: input.account,
            platform: input.platform,
            browser: input.browser,
            browserTimeoutSeconds: input.browserTimeout,
            timeoutMs: input.timeout,
            headers: input.header,
            body: input.body,
            jsonBody: input.jsonBody,
          });
        }
        case "download": {
          const [pathOrUrl] = args;
          if (!pathOrUrl) {
            throw new MikaCliError("TOOLS_HTTP_DOWNLOAD_ARGUMENTS_REQUIRED", "Use: mikacli tools http <target> download <path-or-url> --output <path>.");
          }
          if (!input.output) {
            throw new MikaCliError("TOOLS_HTTP_DOWNLOAD_OUTPUT_REQUIRED", "Use --output <path> to save the downloaded response.");
          }

          return sessionHttpAdapter.download({
            target,
            pathOrUrl,
            outputPath: input.output,
            account: input.account,
            platform: input.platform,
            browser: input.browser,
            browserTimeoutSeconds: input.browserTimeout,
            timeoutMs: input.timeout,
            headers: input.header,
          });
        }
        case "graphql": {
          const query = input.query ?? args.join(" ").trim();
          if (!query) {
            throw new MikaCliError("TOOLS_HTTP_GRAPHQL_QUERY_REQUIRED", "Use: mikacli tools http <target> graphql '<query>' [--variables '{...}'].");
          }

          return sessionHttpAdapter.graphql({
            target,
            query,
            pathOrUrl: input.path,
            variables: input.variables,
            operationName: input.operationName,
            account: input.account,
            platform: input.platform,
            browser: input.browser,
            browserTimeoutSeconds: input.browserTimeout,
            timeoutMs: input.timeout,
            headers: input.header,
          });
        }
        default:
          throw new MikaCliError("TOOLS_HTTP_OPERATION_INVALID", `Unknown tools http operation "${operation}". Use inspect, cookies, storage, capture, request, download, or graphql.`);
      }
    });
  });

  return command;
}

async function runHttpAction(cmd: Command, operation: string, action: () => Promise<AdapterActionResult>) {
  const ctx = resolveCommandContext(cmd);
  const logger = new Logger(ctx);
  const spinner = logger.spinner(getSpinnerText(operation));

  await runCommandAction({
    spinner,
    successMessage: getSuccessMessage(operation),
    action,
    onSuccess: (result) => printSessionHttpResult(normalizeActionResult(result, httpPlatformDefinition, operation), ctx.json),
  });
}

function getSpinnerText(operation: string): string {
  switch (operation.trim().toLowerCase()) {
    case "cookies":
      return "Inspecting matched cookies...";
    case "storage":
      return "Inspecting shared browser storage...";
    case "capture":
      return "Capturing authenticated browser requests...";
    case "request":
      return "Performing authenticated request...";
    case "download":
      return "Downloading authenticated response...";
    case "graphql":
      return "Performing authenticated GraphQL request...";
    default:
      return "Inspecting HTTP target...";
  }
}

function getSuccessMessage(operation: string): string {
  switch (operation.trim().toLowerCase()) {
    case "cookies":
      return "HTTP cookies inspected.";
    case "storage":
      return "HTTP browser storage inspected.";
    case "capture":
      return "HTTP capture completed.";
    case "request":
      return "Authenticated HTTP request completed.";
    case "download":
      return "Authenticated download completed.";
    case "graphql":
      return "Authenticated GraphQL request completed.";
    default:
      return "HTTP target inspected.";
  }
}

function collectOptionValues(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

export const httpPlatformDefinition: PlatformDefinition = {
  id: "http" as PlatformDefinition["id"],
  category: "tools",
  displayName: "HTTP Toolkit",
  description: "Inspect sessions, capture logged-in browser traffic, and replay authenticated requests",
  authStrategies: ["none", "cookies"],
  buildCommand: buildHttpCommand,
  adapter: sessionHttpAdapter,
  examples: EXAMPLES,
};
