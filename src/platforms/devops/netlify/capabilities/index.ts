import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { netlifyAdapter, type NetlifyAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createNetlifyCapabilities(adapter: NetlifyAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Netlify API token for future CLI use",
      spinnerText: "Validating Netlify token...",
      successMessage: "Netlify token saved.",
      options: [
        { flags: "--token <token>", description: "Netlify personal access token", required: true },
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
      description: "Check the saved Netlify token",
      spinnerText: "Checking Netlify token...",
      successMessage: "Netlify token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current Netlify account summary",
      spinnerText: "Loading Netlify account summary...",
      successMessage: "Netlify account summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "accounts",
      command: "accounts",
      description: "List Netlify accounts available to the token",
      spinnerText: "Loading Netlify accounts...",
      successMessage: "Netlify accounts loaded.",
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
      id: "sites",
      command: "sites",
      description: "List Netlify sites",
      spinnerText: "Loading Netlify sites...",
      successMessage: "Netlify sites loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum sites to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.sites({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "deploys",
      command: "deploys",
      aliases: ["deployments"],
      description: "List Netlify deploys, optionally scoped to one site",
      spinnerText: "Loading Netlify deploys...",
      successMessage: "Netlify deploys loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--site <name-or-id>", description: "Optional site name, URL, or site ID to inspect" },
        { flags: "--limit <number>", description: "Maximum deploys to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.deploys({
          account: options.account as string | undefined,
          site: options.site as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "dns",
      command: "dns",
      aliases: ["zones"],
      description: "List Netlify DNS zones",
      spinnerText: "Loading Netlify DNS zones...",
      successMessage: "Netlify DNS zones loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum zones to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.dns({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const netlifyCapabilities: readonly PlatformCapability[] = createNetlifyCapabilities(netlifyAdapter);
