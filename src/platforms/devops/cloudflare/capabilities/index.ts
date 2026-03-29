import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { cloudflareAdapter, type CloudflareAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createCloudflareCapabilities(adapter: CloudflareAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Cloudflare API token for future CLI use",
      spinnerText: "Validating Cloudflare token...",
      successMessage: "Cloudflare token saved.",
      options: [
        { flags: "--token <token>", description: "Cloudflare API token", required: true },
        { flags: "--account <name>", description: "Optional saved connection name" },
      ],
      action: ({ options }) =>
        adapter.login({
          token: options.token as string | undefined,
          account: options.account as string | undefined,
        }),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "status",
      command: "status",
      description: "Check the saved Cloudflare token",
      spinnerText: "Checking Cloudflare token...",
      successMessage: "Cloudflare token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current Cloudflare token summary",
      spinnerText: "Loading Cloudflare token summary...",
      successMessage: "Cloudflare token summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "accounts",
      command: "accounts",
      description: "List Cloudflare accounts accessible to the token",
      spinnerText: "Loading Cloudflare accounts...",
      successMessage: "Cloudflare accounts loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum accounts to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.accounts({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "zones",
      command: "zones",
      description: "List Cloudflare zones",
      spinnerText: "Loading Cloudflare zones...",
      successMessage: "Cloudflare zones loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum zones to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.zones({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "dns",
      command: "dns <zone>",
      aliases: ["records"],
      description: "List DNS records for a Cloudflare zone name or zone ID",
      spinnerText: "Loading Cloudflare DNS records...",
      successMessage: "Cloudflare DNS records loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum records to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ args, options }) =>
        adapter.dns({
          account: options.account as string | undefined,
          zone: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const cloudflareCapabilities: readonly PlatformCapability[] = createCloudflareCapabilities(cloudflareAdapter);
