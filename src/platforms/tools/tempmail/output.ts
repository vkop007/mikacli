import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printTempMailResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  if (result.action === "domains") {
    printDomains(result.data?.domains);
    return;
  }

  if (result.action === "inbox") {
    printMailbox(result.data?.mailbox);
    printInbox(result.data?.messages);
    return;
  }

  if (result.action === "message" || result.action === "wait") {
    printMailbox(result.data?.mailbox);
    printMessage(result.data?.message);
    return;
  }

  if (result.action === "login" || result.action === "create" || result.action === "me" || result.action === "status") {
    printMailbox(result.data?.mailbox ?? result.data?.entity);
  }
}

function printDomains(value: unknown): void {
  const domains = toRecordArray(value);
  if (domains.length === 0) {
    console.log("domains: none");
    return;
  }

  console.log("domains:");
  for (const domain of domains) {
    const name = firstString(domain, ["domain"]) ?? "unknown";
    const meta = [
      domain.isActive === true ? "active" : "inactive",
      domain.isPrivate === true ? "private" : "public",
    ].join(" • ");
    console.log(`  ${name} (${meta})`);
  }
}

function printMailbox(value: unknown): void {
  const mailbox = toRecord(value);
  if (!mailbox) {
    return;
  }

  const address = firstString(mailbox, ["address"]);
  if (address) {
    console.log(`address: ${address}`);
  }

  const quota = mailbox.quota;
  const used = mailbox.used;
  const usagePercent = mailbox.usagePercent;
  if (typeof used === "number" || typeof quota === "number") {
    const parts = [
      typeof used === "number" ? `used ${used}` : undefined,
      typeof quota === "number" ? `quota ${quota}` : undefined,
      typeof usagePercent === "number" ? `${usagePercent}%` : undefined,
    ].filter((item): item is string => Boolean(item));
    if (parts.length > 0) {
      console.log(`storage: ${parts.join(" • ")}`);
    }
  }
}

function printInbox(value: unknown): void {
  const messages = toRecordArray(value);
  if (messages.length === 0) {
    console.log("inbox: empty");
    return;
  }

  console.log("\ninbox:");
  for (const [index, message] of messages.entries()) {
    const subject = firstString(message, ["subject"]) ?? "(no subject)";
    console.log(`${index + 1}. ${subject}`);

    const meta = [
      firstString(message, ["fromAddress"]),
      firstString(message, ["createdAt"]),
      message.seen === true ? "read" : "unread",
      message.hasAttachments === true ? "attachments" : undefined,
    ].filter((item): item is string => Boolean(item));
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }

    const codes = toStringArray(message.verificationCodes);
    if (codes.length > 0) {
      console.log(`   codes: ${codes.join(", ")}`);
    }

    const intro = firstString(message, ["intro"]);
    if (intro) {
      console.log(`   ${intro}`);
    }
  }
}

function printMessage(value: unknown): void {
  const message = toRecord(value);
  if (!message) {
    return;
  }

  for (const [label, key] of [
    ["subject", "subject"],
    ["from", "fromAddress"],
    ["created", "createdAt"],
  ] as const) {
    const nextValue = firstString(message, [key]);
    if (nextValue) {
      console.log(`${label}: ${nextValue}`);
    }
  }

  const codes = toStringArray(message.verificationCodes);
  if (codes.length > 0) {
    console.log(`codes: ${codes.join(", ")}`);
  }

  const links = toStringArray(message.links);
  if (links.length > 0) {
    console.log("links:");
    for (const link of links.slice(0, 5)) {
      console.log(`  ${link}`);
    }
  }

  const attachments = toRecordArray(message.attachments);
  if (attachments.length > 0) {
    console.log("attachments:");
    for (const attachment of attachments) {
      const filename = firstString(attachment, ["filename"]) ?? firstString(attachment, ["id"]) ?? "attachment";
      const meta = [
        firstString(attachment, ["contentType"]),
        typeof attachment.size === "number" ? `${attachment.size} bytes` : undefined,
      ].filter((item): item is string => Boolean(item));
      console.log(`  ${filename}${meta.length > 0 ? ` (${meta.join(" • ")})` : ""}`);
    }
  }

  const text = firstString(message, ["text"]);
  if (text) {
    console.log("\ntext:");
    console.log(text);
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}
