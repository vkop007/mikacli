import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { AutoCliError } from "../../../../errors.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { uptimeRobotAdapter, type UptimeRobotAdapter } from "../adapter.js";
import {
  printUptimeRobotIdentityResult,
  printUptimeRobotIncidentResult,
  printUptimeRobotIntegrationResult,
  printUptimeRobotMonitorResult,
  printUptimeRobotResourceResult,
  printUptimeRobotStatsResult,
} from "../output.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

const accountOption = {
  flags: "--account <name>",
  description: "Optional saved connection name to use",
} as const;

const jsonBodyOption = (description: string) =>
  ({
    flags: "--body <json>",
    description,
    required: true,
    parser: parseJsonObject,
  }) as const;

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
      options: [accountOption],
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
      options: [accountOption],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printUptimeRobotIdentityResult,
    }),
    createAdapterActionCapability({
      id: "alert-contacts",
      command: "alert-contacts",
      description: "List alert contacts configured for the account",
      spinnerText: "Loading UptimeRobot alert contacts...",
      successMessage: "UptimeRobot alert contacts loaded.",
      options: [accountOption],
      action: ({ options }) =>
        adapter.alertContacts({
          account: options.account as string | undefined,
          all: false,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "all-alert-contacts",
      command: "all-alert-contacts",
      description: "List alert contacts across the full UptimeRobot account",
      spinnerText: "Loading all UptimeRobot alert contacts...",
      successMessage: "All UptimeRobot alert contacts loaded.",
      options: [accountOption],
      action: ({ options }) =>
        adapter.alertContacts({
          account: options.account as string | undefined,
          all: true,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "monitors",
      command: "monitors",
      description: "List monitors with optional filtering",
      spinnerText: "Loading UptimeRobot monitors...",
      successMessage: "UptimeRobot monitors loaded.",
      options: [
        accountOption,
        { flags: "--limit <number>", description: "Maximum monitors to return", parser: parsePositiveInteger },
        { flags: "--group-id <id>", description: "Filter by monitor group ID", parser: parsePositiveInteger },
        { flags: "--status <statuses>", description: "Comma-separated statuses such as UP,DOWN,PAUSED" },
        { flags: "--name <text>", description: "Case-insensitive partial monitor name match" },
        { flags: "--url <text>", description: "Case-insensitive partial monitor URL match" },
        { flags: "--tags <tags>", description: "Comma-separated tag names to match" },
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parseCursor },
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
          cursor: options.cursor as number | undefined,
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "monitor",
      command: "monitor <id>",
      description: "Get full details for a monitor by ID",
      spinnerText: "Loading UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor loaded.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.monitor({
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
        accountOption,
        jsonBodyOption('JSON body, for example \'{"friendlyName":"API","url":"https://example.com","type":"HTTP","interval":300,"timeout":30}\''),
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
        accountOption,
        jsonBodyOption('JSON body with the fields to patch, for example \'{"friendlyName":"API (5m)","interval":300}\''),
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
      id: "delete-monitor",
      command: "delete-monitor <id>",
      description: "Delete a monitor by ID",
      spinnerText: "Deleting UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor deleted.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.deleteMonitor({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "reset-monitor",
      command: "reset-monitor <id>",
      description: "Reset a monitor's stored stats",
      spinnerText: "Resetting UptimeRobot monitor stats...",
      successMessage: "UptimeRobot monitor stats reset.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.resetMonitor({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotMonitorResult,
    }),
    createAdapterActionCapability({
      id: "pause",
      command: "pause <id>",
      aliases: ["stop"],
      description: "Pause a monitor by ID",
      spinnerText: "Pausing UptimeRobot monitor...",
      successMessage: "UptimeRobot monitor paused.",
      options: [accountOption],
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
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.start({
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
        accountOption,
        {
          flags: "--time-frame <frame>",
          description: "DAY, WEEK, MONTH, DAYS_30, YEAR, ALL, or CUSTOM",
          required: true,
          parser: parseTimeFrame,
        },
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
        accountOption,
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
        accountOption,
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
      id: "incidents",
      command: "incidents",
      description: "List incidents with optional filtering",
      spinnerText: "Loading UptimeRobot incidents...",
      successMessage: "UptimeRobot incidents loaded.",
      options: [
        accountOption,
        { flags: "--cursor <cursor>", description: "Pagination cursor" },
        { flags: "--monitor-id <id>", description: "Filter by monitor ID", parser: parsePositiveInteger },
        { flags: "--monitor-name <text>", description: "Filter by partial monitor name" },
        { flags: "--started-after <iso>", description: "Filter incidents that started after this ISO 8601 timestamp" },
        { flags: "--started-before <iso>", description: "Filter incidents that started before this ISO 8601 timestamp" },
      ],
      action: ({ options }) =>
        adapter.incidents({
          account: options.account as string | undefined,
          cursor: options.cursor as string | undefined,
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
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.incident({
          account: options.account as string | undefined,
          id: String(args[0]),
        }),
      onSuccess: printUptimeRobotIncidentResult,
    }),
    createAdapterActionCapability({
      id: "incident-comments",
      command: "incident-comments <incident-id>",
      description: "List comments for an incident",
      spinnerText: "Loading UptimeRobot incident comments...",
      successMessage: "UptimeRobot incident comments loaded.",
      options: [
        accountOption,
        { flags: "--cursor <cursor>", description: "Pagination cursor" },
        { flags: "--limit <number>", description: "Maximum comments to return", parser: parsePositiveInteger },
      ],
      action: ({ args, options }) =>
        adapter.incidentComments({
          account: options.account as string | undefined,
          incidentId: String(args[0]),
          cursor: options.cursor as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "create-incident-comment",
      command: "create-incident-comment <incident-id>",
      description: "Create an incident comment from a JSON request body",
      spinnerText: "Creating UptimeRobot incident comment...",
      successMessage: "UptimeRobot incident comment created.",
      options: [
        accountOption,
        jsonBodyOption('JSON body, for example \'{"comment":"Investigating the outage."}\''),
      ],
      action: ({ args, options }) =>
        adapter.createIncidentComment({
          account: options.account as string | undefined,
          incidentId: String(args[0]),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "update-incident-comment",
      command: "update-incident-comment <incident-id> <comment-id>",
      description: "Update an incident comment from a JSON request body",
      spinnerText: "Updating UptimeRobot incident comment...",
      successMessage: "UptimeRobot incident comment updated.",
      options: [
        accountOption,
        jsonBodyOption('JSON body with the fields to patch, for example \'{"comment":"Resolved and monitoring."}\''),
      ],
      action: ({ args, options }) =>
        adapter.updateIncidentComment({
          account: options.account as string | undefined,
          incidentId: String(args[0]),
          commentId: parsePositiveInteger(String(args[1])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "delete-incident-comment",
      command: "delete-incident-comment <incident-id> <comment-id>",
      description: "Delete an incident comment by ID",
      spinnerText: "Deleting UptimeRobot incident comment...",
      successMessage: "UptimeRobot incident comment deleted.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.deleteIncidentComment({
          account: options.account as string | undefined,
          incidentId: String(args[0]),
          commentId: parsePositiveInteger(String(args[1])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "incident-activity-log",
      command: "incident-activity-log <id>",
      description: "Get the activity log for an incident",
      spinnerText: "Loading UptimeRobot incident activity log...",
      successMessage: "UptimeRobot incident activity log loaded.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.incidentActivityLog({
          account: options.account as string | undefined,
          id: String(args[0]),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "incident-alerts",
      command: "incident-alerts <id>",
      description: "List alerts sent for an incident",
      spinnerText: "Loading UptimeRobot incident alerts...",
      successMessage: "UptimeRobot incident alerts loaded.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.incidentAlerts({
          account: options.account as string | undefined,
          id: String(args[0]),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "integrations",
      command: "integrations",
      description: "List alert integrations",
      spinnerText: "Loading UptimeRobot integrations...",
      successMessage: "UptimeRobot integrations loaded.",
      options: [
        accountOption,
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parseCursor },
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
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.integration({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotIntegrationResult,
    }),
    createAdapterActionCapability({
      id: "create-integration",
      command: "create-integration",
      description: "Create an integration from a JSON request body",
      spinnerText: "Creating UptimeRobot integration...",
      successMessage: "UptimeRobot integration created.",
      options: [
        accountOption,
        jsonBodyOption('JSON body for the integration, for example \'{"friendlyName":"Slack","type":"SLACK","value":"https://hooks.slack.com/..."}\''),
      ],
      action: ({ options }) =>
        adapter.createIntegration({
          account: options.account as string | undefined,
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotIntegrationResult,
    }),
    createAdapterActionCapability({
      id: "update-integration",
      command: "update-integration <id>",
      description: "Update an integration from a JSON request body",
      spinnerText: "Updating UptimeRobot integration...",
      successMessage: "UptimeRobot integration updated.",
      options: [
        accountOption,
        jsonBodyOption('JSON body with the fields to patch, for example \'{"friendlyName":"Slack Alerts"}\''),
      ],
      action: ({ args, options }) =>
        adapter.updateIntegration({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotIntegrationResult,
    }),
    createAdapterActionCapability({
      id: "delete-integration",
      command: "delete-integration <id>",
      description: "Delete an integration by ID",
      spinnerText: "Deleting UptimeRobot integration...",
      successMessage: "UptimeRobot integration deleted.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.deleteIntegration({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotIntegrationResult,
    }),
    createAdapterActionCapability({
      id: "monitor-groups",
      command: "monitor-groups",
      description: "List monitor groups",
      spinnerText: "Loading UptimeRobot monitor groups...",
      successMessage: "UptimeRobot monitor groups loaded.",
      options: [
        accountOption,
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parseCursor },
      ],
      action: ({ options }) =>
        adapter.monitorGroups({
          account: options.account as string | undefined,
          cursor: options.cursor as number | undefined,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "monitor-group",
      command: "monitor-group <id>",
      description: "Get monitor group details by ID",
      spinnerText: "Loading UptimeRobot monitor group...",
      successMessage: "UptimeRobot monitor group loaded.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.monitorGroup({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "create-monitor-group",
      command: "create-monitor-group",
      description: "Create a monitor group from a JSON request body",
      spinnerText: "Creating UptimeRobot monitor group...",
      successMessage: "UptimeRobot monitor group created.",
      options: [
        accountOption,
        jsonBodyOption('JSON body, for example \'{"name":"Core Services","monitors":[801150533]}\''),
      ],
      action: ({ options }) =>
        adapter.createMonitorGroup({
          account: options.account as string | undefined,
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "update-monitor-group",
      command: "update-monitor-group <id>",
      description: "Update a monitor group from a JSON request body",
      spinnerText: "Updating UptimeRobot monitor group...",
      successMessage: "UptimeRobot monitor group updated.",
      options: [
        accountOption,
        jsonBodyOption('JSON body with the fields to patch, for example \'{"name":"Critical Services"}\''),
      ],
      action: ({ args, options }) =>
        adapter.updateMonitorGroup({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "delete-monitor-group",
      command: "delete-monitor-group <id>",
      description: "Delete a monitor group by ID",
      spinnerText: "Deleting UptimeRobot monitor group...",
      successMessage: "UptimeRobot monitor group deleted.",
      options: [
        accountOption,
        {
          flags: "--monitors-new-group-id <id>",
          description: "Optional fallback group for monitors being removed with the deleted group",
          parser: parsePositiveInteger,
        },
      ],
      action: ({ args, options }) =>
        adapter.deleteMonitorGroup({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          monitorsNewGroupId: options.monitorsNewGroupId as number | undefined,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "maintenance-windows",
      command: "maintenance-windows",
      description: "List maintenance windows",
      spinnerText: "Loading UptimeRobot maintenance windows...",
      successMessage: "UptimeRobot maintenance windows loaded.",
      options: [
        accountOption,
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parseCursor },
      ],
      action: ({ options }) =>
        adapter.maintenanceWindows({
          account: options.account as string | undefined,
          cursor: options.cursor as number | undefined,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "maintenance-window",
      command: "maintenance-window <id>",
      description: "Get maintenance window details by ID",
      spinnerText: "Loading UptimeRobot maintenance window...",
      successMessage: "UptimeRobot maintenance window loaded.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.maintenanceWindow({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "create-maintenance-window",
      command: "create-maintenance-window",
      description: "Create a maintenance window from a JSON request body",
      spinnerText: "Creating UptimeRobot maintenance window...",
      successMessage: "UptimeRobot maintenance window created.",
      options: [
        accountOption,
        jsonBodyOption('JSON body, for example \'{"name":"DB upgrade","startsAt":"2026-04-07T18:00:00Z","endsAt":"2026-04-07T19:00:00Z"}\''),
      ],
      action: ({ options }) =>
        adapter.createMaintenanceWindow({
          account: options.account as string | undefined,
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "update-maintenance-window",
      command: "update-maintenance-window <id>",
      description: "Update a maintenance window from a JSON request body",
      spinnerText: "Updating UptimeRobot maintenance window...",
      successMessage: "UptimeRobot maintenance window updated.",
      options: [
        accountOption,
        jsonBodyOption('JSON body with the fields to patch, for example \'{"name":"DB upgrade (rescheduled)"}\''),
      ],
      action: ({ args, options }) =>
        adapter.updateMaintenanceWindow({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "delete-maintenance-window",
      command: "delete-maintenance-window <id>",
      description: "Delete a maintenance window by ID",
      spinnerText: "Deleting UptimeRobot maintenance window...",
      successMessage: "UptimeRobot maintenance window deleted.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.deleteMaintenanceWindow({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "psps",
      command: "psps",
      description: "List public status pages",
      spinnerText: "Loading UptimeRobot public status pages...",
      successMessage: "UptimeRobot public status pages loaded.",
      options: [
        accountOption,
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parseCursor },
      ],
      action: ({ options }) =>
        adapter.psps({
          account: options.account as string | undefined,
          cursor: options.cursor as number | undefined,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "psp",
      command: "psp <id>",
      description: "Get public status page details by ID",
      spinnerText: "Loading UptimeRobot public status page...",
      successMessage: "UptimeRobot public status page loaded.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.psp({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "create-psp",
      command: "create-psp",
      description: "Create a public status page from a JSON request body",
      spinnerText: "Creating UptimeRobot public status page...",
      successMessage: "UptimeRobot public status page created.",
      options: [
        accountOption,
        jsonBodyOption('JSON body. File uploads can use descriptors like \'{"logo":{"filePath":"./logo.png","contentType":"image/png"}}\''),
      ],
      action: ({ options }) =>
        adapter.createPsp({
          account: options.account as string | undefined,
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "update-psp",
      command: "update-psp <id>",
      description: "Update a public status page from a JSON request body",
      spinnerText: "Updating UptimeRobot public status page...",
      successMessage: "UptimeRobot public status page updated.",
      options: [
        accountOption,
        jsonBodyOption('JSON body with the fields to patch. File uploads can use descriptors like \'{"logo":{"filePath":"./logo.png"}}\''),
      ],
      action: ({ args, options }) =>
        adapter.updatePsp({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "delete-psp",
      command: "delete-psp <id>",
      description: "Delete a public status page by ID",
      spinnerText: "Deleting UptimeRobot public status page...",
      successMessage: "UptimeRobot public status page deleted.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.deletePsp({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "announcements",
      command: "announcements <psp-id>",
      description: "List announcements for a public status page",
      spinnerText: "Loading UptimeRobot announcements...",
      successMessage: "UptimeRobot announcements loaded.",
      options: [
        accountOption,
        { flags: "--status <status>", description: "Optional announcement status filter" },
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parseCursor },
      ],
      action: ({ args, options }) =>
        adapter.announcements({
          account: options.account as string | undefined,
          pspId: parsePositiveInteger(String(args[0])),
          status: options.status as string | undefined,
          cursor: options.cursor as number | undefined,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "announcement",
      command: "announcement <psp-id> <id>",
      description: "Get announcement details by ID",
      spinnerText: "Loading UptimeRobot announcement...",
      successMessage: "UptimeRobot announcement loaded.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.announcement({
          account: options.account as string | undefined,
          pspId: parsePositiveInteger(String(args[0])),
          id: parsePositiveInteger(String(args[1])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "create-announcement",
      command: "create-announcement <psp-id>",
      description: "Create an announcement from a JSON request body",
      spinnerText: "Creating UptimeRobot announcement...",
      successMessage: "UptimeRobot announcement created.",
      options: [
        accountOption,
        jsonBodyOption('JSON body, for example \'{"title":"Maintenance","message":"Work starts at 18:00 UTC."}\''),
      ],
      action: ({ args, options }) =>
        adapter.createAnnouncement({
          account: options.account as string | undefined,
          pspId: parsePositiveInteger(String(args[0])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "update-announcement",
      command: "update-announcement <psp-id> <id>",
      description: "Update an announcement from a JSON request body",
      spinnerText: "Updating UptimeRobot announcement...",
      successMessage: "UptimeRobot announcement updated.",
      options: [
        accountOption,
        jsonBodyOption('JSON body with the fields to patch, for example \'{"title":"Maintenance update"}\''),
      ],
      action: ({ args, options }) =>
        adapter.updateAnnouncement({
          account: options.account as string | undefined,
          pspId: parsePositiveInteger(String(args[0])),
          id: parsePositiveInteger(String(args[1])),
          body: options.body as Record<string, unknown>,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "pin-announcement",
      command: "pin-announcement <psp-id> <id>",
      description: "Pin an announcement on a public status page",
      spinnerText: "Pinning UptimeRobot announcement...",
      successMessage: "UptimeRobot announcement pinned.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.pinAnnouncement({
          account: options.account as string | undefined,
          pspId: parsePositiveInteger(String(args[0])),
          id: parsePositiveInteger(String(args[1])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "unpin-announcement",
      command: "unpin-announcement <psp-id> <id>",
      description: "Unpin an announcement on a public status page",
      spinnerText: "Unpinning UptimeRobot announcement...",
      successMessage: "UptimeRobot announcement unpinned.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.unpinAnnouncement({
          account: options.account as string | undefined,
          pspId: parsePositiveInteger(String(args[0])),
          id: parsePositiveInteger(String(args[1])),
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "tags",
      command: "tags",
      description: "List account tags",
      spinnerText: "Loading UptimeRobot tags...",
      successMessage: "UptimeRobot tags loaded.",
      options: [
        accountOption,
        { flags: "--cursor <cursor>", description: "Pagination cursor", parser: parseCursor },
      ],
      action: ({ options }) =>
        adapter.tags({
          account: options.account as string | undefined,
          cursor: options.cursor as number | undefined,
        }),
      onSuccess: printUptimeRobotResourceResult,
    }),
    createAdapterActionCapability({
      id: "delete-tag",
      command: "delete-tag <id>",
      description: "Delete a tag by ID",
      spinnerText: "Deleting UptimeRobot tag...",
      successMessage: "UptimeRobot tag deleted.",
      options: [accountOption],
      action: ({ args, options }) =>
        adapter.deleteTag({
          account: options.account as string | undefined,
          id: parsePositiveInteger(String(args[0])),
        }),
      onSuccess: printUptimeRobotResourceResult,
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
