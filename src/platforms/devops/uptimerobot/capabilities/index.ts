import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { AutoCliError } from "../../../../errors.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { uptimeRobotAdapter, type UptimeRobotAdapter } from "../adapter.js";
import {
  printUptimeRobotIdentityResult,
  printUptimeRobotIncidentResult,
  printUptimeRobotIntegrationResult,
  printUptimeRobotMonitorResult,
  printUptimeRobotStatsResult,
} from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createUptimeRobotCapabilities(adapter: UptimeRobotAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a UptimeRobot API token for future CLI use",
      spinnerText: "Validating UptimeRobot token...",
      successMessage: "UptimeRobot token saved.",
      options: [
        { flags: "--token <token>", description: "UptimeRobot API token", required: true },
        { flags: "--account <name>", description: "Optional saved connection name" },
      ],
      action: ({ options }) =>
        adapter.login({
          token: options.token as string | undefined,
          account: options.account as string | undefined,
        }),
      onSuccess: printUptimeRobotIdentityResult,
    }),
    createAdapterActionCapability({
      id: "status",
      command: "status",
      description: "Check the saved UptimeRobot token",
      spinnerText: "Checking UptimeRobot token...",
      successMessage: "UptimeRobot token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printUptimeRobotIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current UptimeRobot account summary",
      spinnerText: "Loading UptimeRobot account summary...",
      successMessage: "UptimeRobot account summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printUptimeRobotIdentityResult,
    }),
    createAdapterActionCapability({
      id: "monitors",
      command: "monitors",
      description: "List monitors with optional filtering",
      spinnerText: "Loading UptimeRobot monitors...",
      successMessage: "UptimeRobot monitors loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum monitors to return", parser: parsePositiveInteger },
        { flags: "--group-id <id>", description: "Filter by monitor group ID", parser: parsePositiveInteger },
        { flags: "--status <statuses>", description: "Comma-separated statuses such as UP,DOWN,PAUSED" },
        { flags: "--name <text>", description: "Case-insensitive partial monitor name match" },
        { flags: "--url <text>", description: "Case-insensitive partial monitor URL match" },
        { flags: "--tags <tags>", description: "Comma-separated tag names to match" },
        { flags: "--cursor <cursor>", description: "Pagination cursor" },
      ],
      action: ({ options }) =>
        adapter.monitors({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
          groupId: options.groupId as number | undefined,
          status: options.status as string | undefined,
          name: options.name as string | undefined,
          url: options.url as string | undefined,
          tags: options.tags as string | undefined,
          cursor: options.cursor ? parseCursor(String(options.cursor)) : undefined,
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "monitor",
      command: "monitor <id>",
      description: "Get full details for a monitor by ID",
      spinnerText: "Loading UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.monitor({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "uptime-stats",
      command: "uptime-stats",
      description: "Get aggregated uptime stats across all monitors",
      spinnerText: "Loading aggregated UptimeRobot stats...",
      successMessage: "Aggregated UptimeRobot stats loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--time-frame <frame>", description: "DAY, WEEK, MONTH, DAYS_30, YEAR, ALL, or CUSTOM", required: true, parser: parseTimeFrame },
        { flags: "--start <unix>", description: "Custom range start timestamp in Unix seconds", parser: parsePositiveInteger },
        { flags: "--end <unix>", description: "Custom range end timestamp in Unix seconds", parser: parsePositiveInteger },
        { flags: "--log-limit <number>", description: "Maximum log entries to return", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.uptimeStats({
          account: options.account as string | undefined,
          timeFrame: options.timeFrame as string,
          start: options.start as number | undefined,
          end: options.end as number | undefined,
          logLimit: options.logLimit as number | undefined,
        }),
      onSuccess: printUptimeRobotStatsResult,
    }),
    createAdapterActionCapability({
      id: "monitor-stats",
      command: "monitor-stats <id>",
      aliases: ["monitor-uptime"],
      description: "Get uptime stats for a specific monitor",
      spinnerText: "Loading monitor uptime stats...",
      successMessage: "Monitor uptime stats loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--from <iso>", description: "Start date in ISO 8601 format" },
        { flags: "--to <iso>", description: "End date in ISO 8601 format" },
      ],
      action: ({ args, options }) =>
        adapter.monitorStats({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          from: options.from as string | undefined,
          to: options.to as string | undefined,
        }),
      onSuccess: printUptimeRobotStatsResult,
    }),
    createAdapterActionCapability({
      id: "response-times",
      command: "response-times <id>",
      aliases: ["response-time"],
      description: "Get response time stats for a specific monitor",
      spinnerText: "Loading monitor response times...",
      successMessage: "Monitor response times loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--from <iso>", description: "Start date in ISO 8601 format" },
        { flags: "--to <iso>", description: "End date in ISO 8601 format" },
        { flags: "--time-series", description: "Include time series points in the response" },
      ],
      action: ({ args, options }) =>
        adapter.responseTimes({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          from: options.from as string | undefined,
          to: options.to as string | undefined,
          includeTimeSeries: Boolean(options.timeSeries),
        }),
      onSuccess: printUptimeRobotStatsResult,
    }),
    createAdapterActionCapability({
      id: "pause",
      command: "pause <id>",
      aliases: ["stop"],
      description: "Pause a monitor by ID",
      spinnerText: "Pausing UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor paused.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.pause({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "start",
      command: "start <id>",
      aliases: ["resume"],
      description: "Start a paused monitor by ID",
      spinnerText: "Starting UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor started.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.start({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "create-monitor",
      command: "create-monitor",
      description: "Create a monitor from a JSON request body",
      spinnerText: "Creating UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor created.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        {
          flags: "--body <json>",
          description: 'JSON body, for example \'{"friendlyName":"API","url":"https://example.com","type":"HTTP","interval":300}\'',
          required: true,
          parser: parseJsonObject,
        },
      ],
      action: ({ options }) =>
        adapter.createMonitor({
          account: options.account as string | undefined,
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "update-monitor",
      command: "update-monitor <id>",
      description: "Update a monitor from a JSON request body",
      spinnerText: "Updating UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor updated.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        {
          flags: "--body <json>",
          description: 'JSON body with the fields to patch, for example \'{"friendlyName":"API (5m)","interval":300}\'',
          required: true,
          parser: parseJsonObject,
        },
      ],
      action: ({ args, options }) =>
        adapter.updateMonitor({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "incidents",
      command: "incidents",
      description: "List incidents with optional filtering",
      spinnerText: "Loading UptimeRobot incidents...",
      successMessage: "UptimeRobot incidents loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--cursor <cursor>", description: "Pagination cursor" },
        { flags: "--monitor-id <id>", description: "Filter by monitor ID", parser: parsePositiveInteger },
        { flags: "--monitor-name <text>", description: "Filter by partial monitor name" },
        { flags: "--started-after <iso>", description: "Filter incidents that started after this ISO 8601 timestamp" },
        { flags: "--started-before <iso>", description: "Filter incidents that started before this ISO 8601 timestamp" },
      ],
      action: ({ options }) =>
        adapter.incidents({
          account: options.account as string | undefined,
          cursor: options.cursor ? String(options.cursor) : undefined,
          monitorId: options.monitorId as number | undefined,
          monitorName: options.monitorName as string | undefined,
          startedAfter: options.startedAfter as string | undefined,
          startedBefore: options.startedBefore as string | undefined,
        }),
      onSuccess: printUptimeRobotIncidentResult,
    }),
    createAdapterActionCapability({
      id: "incident",
      command: "incident <id>",
      description: "Get incident details by ID",
      spinnerText: "Loading UptimeRobot incident...",
      successMessage: "UptimeRobot incident loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.incident({
          account: options.account as string | undefined,
          id: String(args[0]),
        }),
      onSuccess: printUptimeRobotIncidentResult,
    }),
    createAdapterActionCapability({
      id: "integrations",
      command: "integrations",
      description: "List alert integrations",
      spinnerText: "Loading UptimeRobot integrations...",
      successMessage: "UptimeRobot integrations loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.integrations({
          account: options.account as string | undefined,
          cursor: options.cursor as number | undefined,
        }),
      onSuccess: printUptimeRobotIntegrationResult,
    }),
    createAdapterActionCapability({
      id: "integration",
      command: "integration <id>",
      description: "Get integration details by ID",
      spinnerText: "Loading UptimeRobot integration...",
      successMessage: "UptimeRobot integration loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.integration({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotIntegrationResult,
    }),
  ];
}

export const uptimeRobotCapabilities: readonly PlatformCapability[] = createUptimeRobotCapabilities(uptimeRobotAdapter);

function parseJsonObject(value: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new AutoCliError("INVALID_JSON", `Expected a valid JSON object, received "${value}".`, {
      cause: error,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AutoCliError("INVALID_JSON_OBJECT", "Expected a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function parseTimeFrame(value: string): string {
  const normalized = value.trim().toUpperCase();
  const allowed = new Set<string>(["DAY", "WEEK", "MONTH", "DAYS_30", "YEAR", "ALL", "CUSTOM"]);
  if (!allowed.has(normalized)) {
    throw new AutoCliError(
      "INVALID_UPTIMEROBOT_TIMEFRAME",
      `Unsupported time frame "${value}". Expected DAY, WEEK, MONTH, DAYS_30, YEAR, ALL, or CUSTOM.`,
    );
  }

  return normalized;
}

function parseCursor(value: string): number {
  return parsePositiveInteger(value);
}
