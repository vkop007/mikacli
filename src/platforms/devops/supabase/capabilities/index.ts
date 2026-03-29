import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { supabaseAdapter, type SupabaseAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createSupabaseCapabilities(adapter: SupabaseAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Supabase management token for future CLI use",
      spinnerText: "Validating Supabase token...",
      successMessage: "Supabase token saved.",
      options: [
        { flags: "--token <token>", description: "Supabase management token", required: true },
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
      description: "Check the saved Supabase token",
      spinnerText: "Checking Supabase token...",
      successMessage: "Supabase token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the current Supabase workspace summary",
      spinnerText: "Loading Supabase workspace summary...",
      successMessage: "Supabase workspace summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "organizations",
      command: "organizations",
      aliases: ["orgs"],
      description: "List Supabase organizations visible to the token",
      spinnerText: "Loading Supabase organizations...",
      successMessage: "Supabase organizations loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--limit <number>", description: "Maximum organizations to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.organizations({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "projects",
      command: "projects",
      description: "List Supabase projects, optionally filtered by organization ID",
      spinnerText: "Loading Supabase projects...",
      successMessage: "Supabase projects loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--organization <id>", description: "Optional organization ID to filter by" },
        { flags: "--limit <number>", description: "Maximum projects to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.projects({
          account: options.account as string | undefined,
          organization: options.organization as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "functions",
      command: "functions <project>",
      aliases: ["edge-functions"],
      description: "List Supabase Edge Functions for a project name, ref, or ID",
      spinnerText: "Loading Supabase Edge Functions...",
      successMessage: "Supabase Edge Functions loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.functions({
          account: options.account as string | undefined,
          project: String(args[0] ?? ""),
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const supabaseCapabilities: readonly PlatformCapability[] = createSupabaseCapabilities(supabaseAdapter);
