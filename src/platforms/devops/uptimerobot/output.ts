import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

type PrintableRecord = Record<string, unknown>;

export function printUptimeRobotIdentityResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const user = toRecord(result.data?.user);
  if (!user) {
    return;
  }

  const meta = [
    firstString(user, ["displayName", "email"]),
    prefixed(user, "plan"),
    prefixed(user, "monitorsCount", "monitors"),
    prefixed(user, "monitorLimit", "limit"),
    prefixed(user, "subscriptionStatus", "subscription"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const expiresAt = firstString(user, ["subscriptionExpiresAt"]);
  if (expiresAt) {
    console.log(`expires: ${expiresAt}`);
  }
}

export function printUptimeRobotMonitorResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const monitors = toRecordArray(result.data?.monitors);
  if (monitors.length > 0) {
    for (const [index, monitor] of monitors.entries()) {
      printMonitorLine(monitor, index + 1);
    }
    printNextLink(result.data);
    return;
  }

  const monitor = toRecord(result.data?.monitor);
  if (monitor) {
    printMonitorDetail(monitor);
  }
}

export function printUptimeRobotStatsResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const aggregated = toRecord(result.data?.uptimeStats);
  if (aggregated) {
    printAggregatedUptimeStats(aggregated);
    return;
  }

  const monitorStats = toRecord(result.data?.monitorStats);
  if (monitorStats) {
    printMonitorUptimeStats(monitorStats);
    return;
  }

  const responseTimes = toRecord(result.data?.responseTimes);
  if (responseTimes) {
    printResponseTimeStats(responseTimes);
  }
}

export function printUptimeRobotIncidentResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const incidents = toRecordArray(result.data?.incidents);
  if (incidents.length > 0) {
    for (const [index, incident] of incidents.entries()) {
      printIncidentLine(incident, index + 1);
    }
    printNextLink(result.data);
    return;
  }

  const incident = toRecord(result.data?.incident);
  if (incident) {
    printIncidentDetail(incident);
  }
}

export function printUptimeRobotIntegrationResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const integrations = toRecordArray(result.data?.integrations);
  if (integrations.length > 0) {
    for (const [index, integration] of integrations.entries()) {
      printIntegrationLine(integration, index + 1);
    }
    printNextLink(result.data);
    return;
  }

  const integration = toRecord(result.data?.integration);
  if (integration) {
    printIntegrationDetail(integration);
  }
}

function printMonitorLine(monitor: PrintableRecord, index: number): void {
  const title = firstString(monitor, ["friendlyName", "url", "id"]) ?? `Monitor ${index}`;
  console.log(`${index}. ${title}`);

  const meta = [
    prefixed(monitor, "id"),
    prefixed(monitor, "status"),
    prefixed(monitor, "type"),
    formatSecondsMeta(monitor.interval, "interval"),
    formatSecondsMeta(monitor.currentStateDuration, "state"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(`   ${meta.join(" • ")}`);
  }

  const url = firstString(monitor, ["url"]);
  if (url && url !== title) {
    console.log(`   ${url}`);
  }
}

function printMonitorDetail(monitor: PrintableRecord): void {
  const title = firstString(monitor, ["friendlyName", "url", "id"]);
  if (title) {
    console.log(title);
  }

  const meta = [
    prefixed(monitor, "id"),
    prefixed(monitor, "status"),
    prefixed(monitor, "type"),
    formatSecondsMeta(monitor.interval, "interval"),
    formatSecondsMeta(monitor.timeout, "timeout"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const url = firstString(monitor, ["url"]);
  if (url && url !== title) {
    console.log(url);
  }

  const tags = extractTags(monitor);
  if (tags.length > 0) {
    console.log(`tags: ${tags.join(", ")}`);
  }

  const sslExpiry = firstString(monitor, ["sslExpiryDateTime"]);
  if (sslExpiry) {
    console.log(`ssl expiry: ${sslExpiry}`);
  }

  const domainExpiry = firstString(monitor, ["domainExpireDate"]);
  if (domainExpiry) {
    console.log(`domain expiry: ${domainExpiry}`);
  }
}

function printAggregatedUptimeStats(stats: PrintableRecord): void {
  const overall = asNumber(stats.overallUptime);
  if (typeof overall === "number") {
    console.log(`overall uptime: ${overall}%`);
  }

  const meta = [
    prefixed(stats, "affectedMonitors", "affected monitors"),
    prefixed(stats, "totalIncidents", "incidents"),
    prefixed(stats, "totalTimeWithoutIncidents", "time without incidents"),
    formatSecondsMeta(stats.mtbf, "mtbf"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const logs = Array.isArray(stats.logs) ? stats.logs : [];
  if (logs.length > 0) {
    console.log(`logs: ${logs.length}`);
  }
}

function printMonitorUptimeStats(stats: PrintableRecord): void {
  const uptime = asNumber(stats.uptime);
  if (typeof uptime === "number") {
    console.log(`uptime: ${uptime}%`);
  }

  const meta = [
    prefixed(stats, "incident_count", "incidents"),
    prefixed(stats, "total_downtime_seconds", "downtime seconds"),
    formatSecondsMeta(stats.mtbf, "mtbf"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const from = firstString(stats, ["from"]);
  const to = firstString(stats, ["to"]);
  if (from || to) {
    console.log(`range: ${from ?? "?"} -> ${to ?? "?"}`);
  }
}

function printResponseTimeStats(stats: PrintableRecord): void {
  const summary = toRecord(stats.summary);
  if (summary) {
    const meta = [
      prefixed(summary, "avg", "avg ms"),
      prefixed(summary, "min", "min ms"),
      prefixed(summary, "max", "max ms"),
      prefixed(stats, "data_points", "points"),
    ].filter((value): value is string => Boolean(value));

    if (meta.length > 0) {
      console.log(meta.join(" • "));
    }
  }

  const from = firstString(stats, ["from"]);
  const to = firstString(stats, ["to"]);
  if (from || to) {
    console.log(`range: ${from ?? "?"} -> ${to ?? "?"}`);
  }

  const timeSeries = Array.isArray(stats.time_series) ? stats.time_series : [];
  if (timeSeries.length > 0) {
    console.log(`time series points: ${timeSeries.length}`);
  }
}

function printIncidentLine(incident: PrintableRecord, index: number): void {
  const id = firstString(incident, ["id"]) ?? "?";
  const monitor = toRecord(incident.monitor);
  const title = firstString(monitor ?? undefined, ["friendlyName"]) ?? firstString(incident, ["reason"]) ?? `Incident ${id}`;
  console.log(`${index}. #${id} ${title}`.trim());

  const meta = [
    prefixed(incident, "status"),
    prefixed(incident, "type"),
    formatSecondsMeta(incident.duration, "duration"),
    prefixed(monitor ?? undefined, "id", "monitor"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(`   ${meta.join(" • ")}`);
  }

  const reason = firstString(incident, ["reason"]);
  if (reason && reason !== title) {
    console.log(`   ${reason}`);
  }
}

function printIncidentDetail(incident: PrintableRecord): void {
  const id = firstString(incident, ["id"]);
  if (id) {
    console.log(`Incident #${id}`);
  }

  const meta = [
    prefixed(incident, "status"),
    prefixed(incident, "type"),
    prefixed(incident, "cause"),
    formatSecondsMeta(incident.duration, "duration"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  const reason = firstString(incident, ["reason"]);
  if (reason) {
    console.log(reason);
  }

  const startedAt = firstString(incident, ["startedAt"]);
  const resolvedAt = firstString(incident, ["resolvedAt"]);
  if (startedAt || resolvedAt) {
    console.log(`window: ${startedAt ?? "?"} -> ${resolvedAt ?? "ongoing"}`);
  }

  const rootCause = toRecord(incident.rootCause);
  if (rootCause) {
    const rootMeta = [
      prefixed(rootCause, "httpResponseCode", "http"),
      firstString(rootCause, ["url"]),
    ].filter((value): value is string => Boolean(value));

    if (rootMeta.length > 0) {
      console.log(`root cause: ${rootMeta.join(" • ")}`);
    }
  }
}

function printIntegrationLine(integration: PrintableRecord, index: number): void {
  const title = firstString(integration, ["friendlyName", "type", "id"]) ?? `Integration ${index}`;
  console.log(`${index}. ${title}`);

  const meta = [
    prefixed(integration, "id"),
    prefixed(integration, "status"),
    prefixed(integration, "type"),
    prefixed(integration, "enableNotificationsFor", "notify"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(`   ${meta.join(" • ")}`);
  }

  const detail = firstString(integration, ["value", "customValue"]);
  if (detail) {
    console.log(`   ${detail}`);
  }
}

function printIntegrationDetail(integration: PrintableRecord): void {
  const title = firstString(integration, ["friendlyName", "type", "id"]);
  if (title) {
    console.log(title);
  }

  const meta = [
    prefixed(integration, "id"),
    prefixed(integration, "status"),
    prefixed(integration, "type"),
    prefixed(integration, "enableNotificationsFor", "notify"),
  ].filter((value): value is string => Boolean(value));

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  for (const key of ["value", "customValue", "customValue2", "customValue3", "customValue4"]) {
    const value = firstString(integration, [key]);
    if (value) {
      console.log(`${key}: ${value}`);
    }
  }
}

function printNextLink(data: Record<string, unknown> | undefined): void {
  const nextLink = firstString(data, ["nextLink"]);
  if (nextLink) {
    console.log(`next: ${nextLink}`);
  }
}

function extractTags(record: PrintableRecord): string[] {
  const direct = record.tagNames;
  if (Array.isArray(direct)) {
    return direct.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  }

  const tags = Array.isArray(record.tags) ? record.tags : [];
  return tags
    .map((entry) => toRecord(entry))
    .filter((entry): entry is PrintableRecord => Boolean(entry))
    .map((entry) => firstString(entry, ["name"]))
    .filter((value): value is string => Boolean(value));
}

function formatSecondsMeta(value: unknown, label: string): string | undefined {
  const seconds = asNumber(value);
  if (typeof seconds !== "number") {
    return undefined;
  }

  return `${label} ${formatSeconds(seconds)}`;
}

function formatSeconds(value: number): string {
  const rounded = Math.max(0, Math.round(value));
  if (rounded < 60) {
    return `${rounded}s`;
  }

  if (rounded < 3600) {
    return `${Math.round(rounded / 60)}m`;
  }

  if (rounded < 86400) {
    return `${Math.round(rounded / 3600)}h`;
  }

  return `${Math.round(rounded / 86400)}d`;
}

function prefixed(record: PrintableRecord | undefined, key: string, label = key): string | undefined {
  if (!record) {
    return undefined;
  }

  const value = firstString(record, [key]);
  if (!value) {
    return undefined;
  }

  return `${label} ${value}`;
}

function firstString(record: PrintableRecord | undefined, keys: readonly string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return String(value);
    }
  }

  return undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toRecord(value: unknown): PrintableRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as PrintableRecord;
}

function toRecordArray(value: unknown): PrintableRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is PrintableRecord => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}
