import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { parsePositiveInteger } from "../../shared/options.js";
import { printDevopsIdentityResult, printDevopsListResult } from "../../shared/output.js";
import { flyAdapter, type FlyAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export function createFlyCapabilities(adapter: FlyAdapter): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Fly Machines API token for future CLI use",
      spinnerText: "Saving Fly token...",
      successMessage: "Fly token saved.",
      options: [
        { flags: "--token <token>", description: "Fly API token", required: true },
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
      description: "Check the saved Fly token",
      spinnerText: "Checking Fly token...",
      successMessage: "Fly token checked.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Show the saved Fly org context and cached app summary",
      spinnerText: "Loading Fly workspace summary...",
      successMessage: "Fly workspace summary loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ options }) => adapter.me(options.account as string | undefined),
      onSuccess: printDevopsIdentityResult,
    }),
    createAdapterActionCapability({
      id: "apps",
      command: "apps",
      description: "List Fly apps for an organization slug",
      spinnerText: "Loading Fly apps...",
      successMessage: "Fly apps loaded.",
      options: [
        { flags: "--account <name>", description: "Optional saved connection name to use" },
        { flags: "--org <slug>", description: "Organization slug to inspect (defaults to saved org or personal)" },
        { flags: "--limit <number>", description: "Maximum apps to return (default: 20)", parser: parsePositiveInteger },
      ],
      action: ({ options }) =>
        adapter.apps({
          account: options.account as string | undefined,
          org: options.org as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "app",
      command: "app <name>",
      description: "Load a Fly app by name",
      spinnerText: "Loading Fly app...",
      successMessage: "Fly app loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.app({
          account: options.account as string | undefined,
          app: String(args[0] ?? ""),
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "machines",
      command: "machines <app>",
      description: "List Fly Machines for an app",
      spinnerText: "Loading Fly Machines...",
      successMessage: "Fly Machines loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.machines({
          account: options.account as string | undefined,
          app: String(args[0] ?? ""),
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "volumes",
      command: "volumes <app>",
      description: "List Fly volumes for an app",
      spinnerText: "Loading Fly volumes...",
      successMessage: "Fly volumes loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.volumes({
          account: options.account as string | undefined,
          app: String(args[0] ?? ""),
        }),
      onSuccess: printDevopsListResult,
    }),
    createAdapterActionCapability({
      id: "certificates",
      command: "certificates <app>",
      aliases: ["certs"],
      description: "List Fly certificates for an app",
      spinnerText: "Loading Fly certificates...",
      successMessage: "Fly certificates loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved connection name to use" }],
      action: ({ args, options }) =>
        adapter.certificates({
          account: options.account as string | undefined,
          app: String(args[0] ?? ""),
        }),
      onSuccess: printDevopsListResult,
    }),
  ];
}

export const flyCapabilities: readonly PlatformCapability[] = createFlyCapabilities(flyAdapter);
