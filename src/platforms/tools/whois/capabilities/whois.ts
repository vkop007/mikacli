import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { whoisAdapter, type WhoisAdapter } from "../adapter.js";
import { printWhoisResult } from "../output.js";

export function createWhoisLookupCapability(adapter: WhoisAdapter) {
  return createAdapterActionCapability({
    id: "lookup",
    command: "lookup <target>",
    aliases: ["whois"],
    description: "Load WHOIS / RDAP data for a domain or IP address",
    spinnerText: "Loading WHOIS data...",
    successMessage: "WHOIS data loaded.",
    action: ({ args }) =>
      adapter.lookup({
        target: String(args[0] ?? ""),
      }),
    onSuccess: printWhoisResult,
  });
}

export const whoisLookupCapability = createWhoisLookupCapability(whoisAdapter);
