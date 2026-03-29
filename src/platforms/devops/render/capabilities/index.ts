import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { renderAdapter, type RenderAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createRenderCapabilities(adapter: RenderAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Render API token for future CLI use",
      spinnerText: "Validating Render token...",
      successMessage: "Render token saved.",
      options: [
        { flags: "--token <token>", description: "Render API token", required: true },
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
      description: "Check the saved Render token",
      spinnerText: "Checking Render token...",
      successMessage: "Render token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current Render account summary",
      spinnerText: "Loading Render account summary...",
      successMessage: "Render account summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "services",
      command: "services",
      description: "List Render services",
      spinnerText: "Loading Render services...",
      successMessage: "Render services loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum services to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.services({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "projects",
      command: "projects",
      description: "List Render projects",
      spinnerText: "Loading Render projects...",
      successMessage: "Render projects loaded.",
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
      id: "env-groups",
      command: "env-groups",
      aliases: ["envgroups"],
      description: "List Render environment groups",
      spinnerText: "Loading Render environment groups...",
      successMessage: "Render environment groups loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum groups to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.envGroups({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const renderCapabilities: readonly PlatformCapability[] = createRenderCapabilities(renderAdapter);
