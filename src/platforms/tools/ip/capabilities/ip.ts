import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { ipAdapter, type IpAdapter } from "../adapter.js";
import { printIpResult } from "../output.js";

export function createIpLookupCapability(adapter: IpAdapter) {
  return createAdapterActionCapability({
    id: "ip",
    command: "ip",
    description: "Show the current public IP address",
    spinnerText: "Resolving public IP...",
    successMessage: "Public IP loaded.",
    options: [
      { flags: "--version <value>", description: "IP version preference: 4, 6, any (default: any)", parser: parseIpVersion },
      { flags: "--details", description: "Include country/city/org details when available" },
    ],
    action: ({ options }) =>
      adapter.ip({
        version: options.version as string | undefined,
        details: Boolean(options.details),
      }),
    onSuccess: printIpResult,
  });
}

export const ipLookupCapability = createIpLookupCapability(ipAdapter);

function parseIpVersion(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "4" || normalized === "6" || normalized === "any") {
    return normalized;
  }

  throw new Error(`Invalid version "${value}". Expected one of: 4, 6, any.`);
}
