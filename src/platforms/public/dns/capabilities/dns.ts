import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { dnsAdapter, type DnsAdapter } from "../adapter.js";
import { printDnsResult } from "../output.js";

export function createDnsLookupCapability(adapter: DnsAdapter) {
  return createAdapterActionCapability({
    id: "resolve",
    command: "resolve <name>",
    aliases: ["lookup"],
    description: "Resolve DNS records for a hostname using dns.google",
    spinnerText: "Resolving DNS...",
    successMessage: "DNS resolved.",
    options: [{ flags: "--type <value>", description: "DNS record type (A, AAAA, MX, TXT, CNAME, etc.)" }],
    action: ({ args, options }) =>
      adapter.resolve({
        name: String(args[0] ?? ""),
        type: options.type as string | undefined,
      }),
    onSuccess: printDnsResult,
  });
}

export const dnsLookupCapability = createDnsLookupCapability(dnsAdapter);
