import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { digitalOceanAdapter, type DigitalOceanAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createDigitalOceanCapabilities(adapter: DigitalOceanAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a DigitalOcean API token for future CLI use",
      spinnerText: "Validating DigitalOcean token...",
      successMessage: "DigitalOcean token saved.",
      options: [
        { flags: "--token <token>", description: "DigitalOcean API token", required: true },
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
      description: "Check the saved DigitalOcean token",
      spinnerText: "Checking DigitalOcean token...",
      successMessage: "DigitalOcean token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current DigitalOcean account summary",
      spinnerText: "Loading DigitalOcean account summary...",
      successMessage: "DigitalOcean account summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "apps",
      command: "apps",
      description: "List DigitalOcean App Platform apps",
      spinnerText: "Loading DigitalOcean apps...",
      successMessage: "DigitalOcean apps loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum apps to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.apps({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "deployments",
      command: "deployments <app>",
      aliases: ["deploys"],
      description: "List DigitalOcean deployments for an app name or app ID",
      spinnerText: "Loading DigitalOcean deployments...",
      successMessage: "DigitalOcean deployments loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum deployments to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ args, options }) =>
        adapter.deployments({
          account: options.account as string | undefined,
          app: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "domains",
      command: "domains",
      description: "List DigitalOcean domains",
      spinnerText: "Loading DigitalOcean domains...",
      successMessage: "DigitalOcean domains loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum domains to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.domains({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const digitalOceanCapabilities: readonly PlatformCapability[] = createDigitalOceanCapabilities(digitalOceanAdapter);
