import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { railwayAdapter, type RailwayAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createRailwayCapabilities(adapter: RailwayAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Railway token for future CLI use",
      spinnerText: "Validating Railway token...",
      successMessage: "Railway token saved.",
      options: [
        { flags: "--token <token>", description: "Railway API token", required: true },
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
      description: "Check the saved Railway token",
      spinnerText: "Checking Railway token...",
      successMessage: "Railway token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current Railway account summary",
      spinnerText: "Loading Railway account summary...",
      successMessage: "Railway account summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "projects",
      command: "projects",
      description: "List Railway projects",
      spinnerText: "Loading Railway projects...",
      successMessage: "Railway projects loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum projects to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.projects({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "project",
      command: "project <id>",
      description: "Load a Railway project by ID",
      spinnerText: "Loading Railway project...",
      successMessage: "Railway project loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.project({
          account: options.account as string | undefined,
          id: String(args[0] ?? ""),
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "service",
      command: "service <id>",
      description: "Load a Railway service by ID",
      spinnerText: "Loading Railway service...",
      successMessage: "Railway service loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.service({
          account: options.account as string | undefined,
          id: String(args[0] ?? ""),
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const railwayCapabilities: readonly PlatformCapability[] = createRailwayCapabilities(railwayAdapter);
