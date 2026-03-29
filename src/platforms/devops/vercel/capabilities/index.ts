import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { vercelAdapter, type VercelAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createVercelCapabilities(adapter: VercelAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Vercel API token for future CLI use",
      spinnerText: "Validating Vercel token...",
      successMessage: "Vercel token saved.",
      options: [
        { flags: "--token <token>", description: "Vercel access token", required: true },
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
      description: "Check the saved Vercel token",
      spinnerText: "Checking Vercel token...",
      successMessage: "Vercel token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current Vercel account summary",
      spinnerText: "Loading Vercel account summary...",
      successMessage: "Vercel account summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "teams",
      command: "teams",
      description: "List Vercel teams available to the token",
      spinnerText: "Loading Vercel teams...",
      successMessage: "Vercel teams loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum teams to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.teams({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "projects",
      command: "projects",
      description: "List Vercel projects",
      spinnerText: "Loading Vercel projects...",
      successMessage: "Vercel projects loaded.",
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
      id: "deployments",
      command: "deployments",
      aliases: ["deploys"],
      description: "List recent Vercel deployments, optionally scoped to one project",
      spinnerText: "Loading Vercel deployments...",
      successMessage: "Vercel deployments loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--project <name-or-id>", description: "Optional project name or project ID to filter by" },
        { flags: "--limit <number>", description: "Maximum deployments to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.deployments({
          account: options.account as string | undefined,
          project: options.project as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const vercelCapabilities: readonly PlatformCapability[] = createVercelCapabilities(vercelAdapter);
