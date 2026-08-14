import { Command } from "commander";
import pc from "picocolors";

import {
  PLATFORM_MANAGEMENT_ACTIONS,
  PlatformStateStore,
  managePlatform,
  summarizePlatformStates,
} from "../core/platform-state.js";
import { MikaCliError } from "../errors.js";
import { getIntegrationMetadata } from "../integration-metadata.js";
import { isPlatform } from "../platforms/config.js";
import { getPlatformDefinition, getPlatformDefinitions } from "../platforms/index.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson } from "../utils/output.js";

import type { PlatformAvailability, PlatformManagementAction, ResolvedPlatformState } from "../core/platform-state.js";
import type { PlatformDefinition } from "../core/runtime/platform-definition.js";
import type { PlatformName } from "../platforms/config.js";

type PlatformListOptions = {
  category?: string;
  status?: string;
};

export function createPlatformsCommand(): Command {
  const command = new Command("platforms")
    .description("List, inspect, install, enable, disable, or uninstall bundled platforms")
    .option("--category <category>", "Filter by platform category")
    .option("--status <status>", "Filter by enabled, disabled, or uninstalled")
    .addHelpText(
      "after",
      `
Examples:
  mikacli platforms list
  mikacli platforms status github
  mikacli platforms disable github
  mikacli platforms enable github
  mikacli platforms uninstall github
  mikacli platforms uninstall github --no-preserve-auth
  mikacli platforms install github
`,
    )
    .action(async function platformsAction(this: Command) {
      await printPlatformList(this, this.optsWithGlobals<PlatformListOptions>());
    });

  command
    .command("list")
    .description("List the live platform catalog and persistent availability state")
    .option("--category <category>", "Filter by platform category")
    .option("--status <status>", "Filter by enabled, disabled, or uninstalled")
    .action(async function platformsListAction(this: Command) {
      await printPlatformList(this, this.optsWithGlobals<PlatformListOptions>());
    });

  command
    .command("status")
    .description("Show persistent availability state for one platform")
    .argument("<platform>", "Platform id")
    .action(async function platformsStatusAction(this: Command, platform: string) {
      const ctx = resolveCommandContext(this);
      const definition = requirePlatformDefinition(platform);
      const state = await new PlatformStateStore().get(definition.id);
      const payload = {
        ok: true,
        platform: platformCatalogEntry(definition, state),
        catalog: getIntegrationMetadata(getPlatformDefinitions().length).catalog,
      };
      if (ctx.json) {
        printJson(payload);
        return;
      }
      printPlatformTable([payload.platform]);
    });

  for (const action of PLATFORM_MANAGEMENT_ACTIONS) {
    const subcommand = command
      .command(action)
      .description(managementDescription(action))
      .argument("<platform>", "Platform id");

    if (action === "uninstall") {
      subcommand.option(
        "--no-preserve-auth",
        "Also delete saved sessions and token connections for this platform",
      );
    }

    subcommand.action(async function platformsManageAction(this: Command, platform: string) {
      const ctx = resolveCommandContext(this);
      const definition = requirePlatformDefinition(platform);
      const options = this.optsWithGlobals<{ preserveAuth?: boolean }>();
      const result = await managePlatform(new PlatformStateStore(), definition.id, action, {
        preserveAuth: options.preserveAuth ?? true,
      });

      if (ctx.json) {
        printJson(result);
        return;
      }

      console.log(managementMessage(result.action, definition.displayName, result.changed));
      console.log(`state: ${result.state.status}`);
      if (result.action === "uninstall") {
        console.log(
          result.preserveAuth
            ? "auth: preserved"
            : `auth: removed ${result.removedAuthPaths.length} director${result.removedAuthPaths.length === 1 ? "y" : "ies"}`,
        );
      }
    });
  }

  return command;
}

export async function listPlatformCatalog(
  options: PlatformListOptions = {},
  store: PlatformStateStore = new PlatformStateStore(),
): Promise<{
  ok: true;
  total: number;
  summary: ReturnType<typeof summarizePlatformStates>;
  catalog: unknown;
  platforms: Array<ReturnType<typeof platformCatalogEntry>>;
}> {
  const status = normalizeStatus(options.status);
  const definitions = getPlatformDefinitions();
  const states = await store.list(definitions.map((definition) => definition.id));
  const byPlatform = new Map(states.map((state) => [state.platform, state]));
  const filtered = definitions.filter((definition) => {
    if (options.category && definition.category !== options.category) return false;
    const state = byPlatform.get(definition.id);
    if (status && state?.status !== status) return false;
    return true;
  });
  const filteredStates = filtered.map((definition) => byPlatform.get(definition.id)!);

  return {
    ok: true,
    total: filtered.length,
    summary: summarizePlatformStates(filteredStates),
    catalog: getIntegrationMetadata(definitions.length).catalog,
    platforms: filtered.map((definition) => platformCatalogEntry(definition, byPlatform.get(definition.id)!)),
  };
}

function platformCatalogEntry(definition: PlatformDefinition, state: ResolvedPlatformState) {
  return {
    platform: definition.id,
    displayName: definition.displayName,
    category: definition.category,
    description: definition.description,
    auth: definition.authStrategies,
    needsCredential: !definition.authStrategies.includes("none" as never),
    installed: state.installed,
    enabled: state.enabled,
    status: state.status,
    source: state.source,
    configured: state.configured,
    ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}),
  };
}

async function printPlatformList(command: Command, options: PlatformListOptions): Promise<void> {
  const ctx = resolveCommandContext(command);
  const payload = await listPlatformCatalog(options);
  if (ctx.json) {
    printJson(payload);
    return;
  }
  console.log(
    `Platforms: ${payload.total}. ${payload.summary.enabled} enabled, ${payload.summary.disabled} disabled, ${payload.summary.uninstalled} uninstalled.`,
  );
  printPlatformTable(payload.platforms);
}

function printPlatformTable(
  entries: Array<{ platform: string; category: string; status: string; displayName: string }>,
): void {
  if (entries.length === 0) {
    console.log(pc.dim("No platforms match the selected filters."));
    return;
  }
  const platformWidth = Math.max("platform".length, ...entries.map((entry) => entry.platform.length));
  const categoryWidth = Math.max("category".length, ...entries.map((entry) => entry.category.length));
  const statusWidth = Math.max("status".length, ...entries.map((entry) => entry.status.length));
  console.log(
    pc.bold(
      [
        "platform".padEnd(platformWidth),
        "category".padEnd(categoryWidth),
        "status".padEnd(statusWidth),
        "name",
      ].join("  "),
    ),
  );
  for (const entry of entries) {
    console.log(
      [
        entry.platform.padEnd(platformWidth),
        entry.category.padEnd(categoryWidth),
        entry.status.padEnd(statusWidth),
        entry.displayName,
      ].join("  "),
    );
  }
}

function requirePlatformDefinition(platform: string): PlatformDefinition & { id: PlatformName } {
  if (!isPlatform(platform)) {
    throw new MikaCliError("INVALID_PLATFORM", `Unknown platform "${platform}".`, {
      details: { platform },
    });
  }
  const definition = getPlatformDefinition(platform);
  if (!definition) {
    throw new MikaCliError("INVALID_PLATFORM", `Unknown platform "${platform}".`, {
      details: { platform },
    });
  }
  return definition;
}

function normalizeStatus(status: string | undefined): PlatformAvailability | undefined {
  if (!status) return undefined;
  if (status === "enabled" || status === "disabled" || status === "uninstalled") return status;
  throw new MikaCliError(
    "INVALID_PLATFORM_STATUS",
    `Unknown platform status "${status}". Use enabled, disabled, or uninstalled.`,
    { details: { status } },
  );
}

function managementDescription(action: PlatformManagementAction): string {
  switch (action) {
    case "install": return "Install and enable a bundled platform";
    case "enable": return "Enable an installed platform";
    case "disable": return "Disable a platform without deleting saved auth";
    case "uninstall": return "Uninstall a platform while preserving saved auth by default";
  }
}

function managementMessage(action: PlatformManagementAction, name: string, changed: boolean): string {
  const suffix = changed ? "" : " (already in that state)";
  switch (action) {
    case "install": return `${name} installed and enabled${suffix}.`;
    case "enable": return `${name} enabled${suffix}.`;
    case "disable": return `${name} disabled${suffix}.`;
    case "uninstall": return `${name} uninstalled${suffix}.`;
  }
}
