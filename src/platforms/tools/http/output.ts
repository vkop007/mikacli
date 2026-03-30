import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printSessionHttpResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const action = result.action;
  if (action === "inspect") {
    printInspect(data);
    return;
  }

  if (action === "capture") {
    printCapture(data);
    return;
  }

  if (action === "cookies") {
    printCookies(data);
    return;
  }

  if (action === "storage") {
    printStorage(data);
    return;
  }

  if (action === "request") {
    printRequest(data);
    return;
  }

  if (action === "download") {
    printDownload(data);
    return;
  }

  if (action === "graphql") {
    printGraphql(data);
  }
}

function printInspect(data: Record<string, unknown>): void {
  printKeyValue("platform", data.resolvedPlatform);
  printKeyValue("hostname", data.hostname);
  printKeyValue("base-url", data.baseUrl);
  printKeyValue("start-url", data.startUrl);

  const session = toRecord(data.session);
  if (session.available === true) {
    printKeyValue("session-account", session.account);
    printKeyValue("session-status", toRecord(session.status).state);
    printKeyValue("session-cookies", session.matchingCookieCount ?? session.cookieCount);

    const presentAuthCookies = toStringArray(session.presentAuthCookies);
    if (presentAuthCookies.length > 0) {
      console.log(`session-auth-cookies: ${presentAuthCookies.join(", ")}`);
    }

    const missingAuthCookies = toStringArray(session.missingAuthCookies);
    if (missingAuthCookies.length > 0) {
      console.log(`session-missing-cookies: ${missingAuthCookies.join(", ")}`);
    }
  } else {
    console.log("session: none");
  }

  const browser = toRecord(data.browser);
  if (Object.keys(browser).length > 0) {
    printKeyValue("browser-final-url", browser.finalUrl);
    printKeyValue("browser-cookies", browser.matchingCookieCount ?? browser.cookieCount);

    const localStorageKeys = toStringArray(browser.localStorageKeys);
    if (localStorageKeys.length > 0) {
      console.log(`browser-local-storage: ${localStorageKeys.join(", ")}`);
    }

    const sessionStorageKeys = toStringArray(browser.sessionStorageKeys);
    if (sessionStorageKeys.length > 0) {
      console.log(`browser-session-storage: ${sessionStorageKeys.join(", ")}`);
    }
  }

  const candidates = toStringArray(data.candidates);
  if (candidates.length > 1) {
    console.log(`candidates: ${candidates.join(", ")}`);
  }
}

function printCapture(data: Record<string, unknown>): void {
  printKeyValue("platform", data.resolvedPlatform);
  printKeyValue("hostname", data.hostname);
  printKeyValue("final-url", data.finalUrl);
  printKeyValue("timed-out", data.timedOut);
  printKeyValue("group-by", data.groupBy);

  const summary = toRecord(data.summary);
  const groups = Array.isArray(summary.groups) ? summary.groups : [];
  if (groups.length > 0) {
    console.log("summary:");
    for (const rawGroup of groups.slice(0, 10)) {
      if (!rawGroup || typeof rawGroup !== "object") {
        continue;
      }

      const group = rawGroup as Record<string, unknown>;
      const count = typeof group.count === "number" ? group.count : 0;
      const methods = toStringArray(group.methods).join(", ");
      const statuses = toNumberArray(group.statuses).join(", ");
      const key = typeof group.key === "string" ? group.key : "unknown";
      const details = [
        methods ? `methods=${methods}` : "",
        statuses ? `statuses=${statuses}` : "",
      ].filter(Boolean).join(" ");
      console.log(`  ${count}x ${key}${details ? ` (${details})` : ""}`);
    }
  }

  const requests = Array.isArray(data.requests) ? data.requests : [];
  if (requests.length === 0) {
    console.log("requests: none");
    return;
  }

  console.log("requests:");
  for (const rawRequest of requests) {
    if (!rawRequest || typeof rawRequest !== "object") {
      continue;
    }

    const request = rawRequest as Record<string, unknown>;
    const status = typeof request.status === "number" ? String(request.status) : request.failureText ? "ERR" : "?";
    const method = typeof request.method === "string" ? request.method : "?";
    const url = typeof request.url === "string" ? request.url : "";
    console.log(`  [${status}] ${method} ${url}`);
  }
}

function printRequest(data: Record<string, unknown>): void {
  printKeyValue("platform", data.resolvedPlatform);
  printKeyValue("request-url", data.requestUrl);
  printKeyValue("status", data.status);
  printKeyValue("content-type", data.contentType);
  printKeyValue("used-browser-cookies", data.usedBrowserCookies);

  const body = data.body;
  if (typeof body === "string" && body.trim().length > 0) {
    console.log("body:");
    console.log(limitText(body));
    return;
  }

  if (body && typeof body === "object") {
    console.log("body:");
    console.log(limitText(JSON.stringify(body, null, 2)));
  }
}

function printCookies(data: Record<string, unknown>): void {
  printKeyValue("platform", data.resolvedPlatform);
  printKeyValue("hostname", data.hostname);
  printKeyValue("source", data.source);
  printKeyValue("cookies", data.totalCookies);

  const cookies = Array.isArray(data.cookies) ? data.cookies : [];
  if (cookies.length === 0) {
    console.log("matched-cookies: none");
    return;
  }

  console.log("matched-cookies:");
  for (const rawCookie of cookies as Array<Record<string, unknown>>) {
    const name = typeof rawCookie.name === "string" ? rawCookie.name : "-";
    const domain = typeof rawCookie.domain === "string" ? rawCookie.domain : "";
    const valueLength = typeof rawCookie.valueLength === "number" ? ` len=${rawCookie.valueLength}` : "";
    const flags = [
      rawCookie.httpOnly === true ? "httpOnly" : "",
      rawCookie.secure === true ? "secure" : "",
      typeof rawCookie.sameSite === "string" ? `sameSite=${rawCookie.sameSite}` : "",
    ].filter(Boolean).join(" ");
    console.log(`  ${name}${domain ? ` @ ${domain}` : ""}${valueLength}${flags ? ` (${flags})` : ""}`);
  }
}

function printStorage(data: Record<string, unknown>): void {
  printKeyValue("platform", data.resolvedPlatform);
  printKeyValue("hostname", data.hostname);
  printKeyValue("local-storage", data.localStorageCount);
  printKeyValue("session-storage", data.sessionStorageCount);

  const localStorage = Array.isArray(data.localStorage) ? data.localStorage : [];
  if (localStorage.length > 0) {
    console.log("local-storage:");
    printStorageEntries(localStorage as Array<Record<string, unknown>>);
  }

  const sessionStorage = Array.isArray(data.sessionStorage) ? data.sessionStorage : [];
  if (sessionStorage.length > 0) {
    console.log("session-storage:");
    printStorageEntries(sessionStorage as Array<Record<string, unknown>>);
  }
}

function printDownload(data: Record<string, unknown>): void {
  printKeyValue("platform", data.resolvedPlatform);
  printKeyValue("request-url", data.requestUrl);
  printKeyValue("status", data.status);
  printKeyValue("content-type", data.contentType);
  printKeyValue("bytes", data.bytes);
  printKeyValue("output", data.outputPath);
  printKeyValue("used-browser-cookies", data.usedBrowserCookies);
}

function printGraphql(data: Record<string, unknown>): void {
  printKeyValue("platform", data.resolvedPlatform);
  printKeyValue("request-url", data.requestUrl);
  printKeyValue("status", data.status);
  printKeyValue("content-type", data.contentType);
  printKeyValue("operation-name", data.operationName);
  printKeyValue("used-browser-cookies", data.usedBrowserCookies);

  const body = data.body;
  if (typeof body === "string" && body.trim().length > 0) {
    console.log("body:");
    console.log(limitText(body));
    return;
  }

  if (body && typeof body === "object") {
    console.log("body:");
    console.log(limitText(JSON.stringify(body, null, 2)));
  }
}

function printKeyValue(label: string, value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    console.log(`${label}: ${value}`);
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    console.log(`${label}: ${String(value)}`);
  }
}

function limitText(value: string): string {
  return value.length > 4_000 ? `${value.slice(0, 4_000)}...` : value;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}

function printStorageEntries(entries: Array<Record<string, unknown>>): void {
  for (const entry of entries) {
    const key = typeof entry.key === "string" ? entry.key : "-";
    const valueLength = typeof entry.valueLength === "number" ? ` len=${entry.valueLength}` : "";
    const jsonLike = entry.jsonLike === true ? " json-like" : "";
    console.log(`  ${key}${valueLength}${jsonLike ? ` (${jsonLike.trim()})` : ""}`);
  }
}
