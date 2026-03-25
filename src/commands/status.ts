import { Command } from "commander";

import { ConnectionStore } from "../core/auth/connection-store.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson, printStatusTable } from "../utils/output.js";

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Show all connected accounts and their last known session status")
    .action(async function statusAction(this: Command) {
      const ctx = resolveCommandContext(this);
      const connectionStore = new ConnectionStore();
      const connections = await connectionStore.listConnections();
      const statuses = connections.map(({ connection, path }) => ({
        platform: connection.platform,
        account: connection.account,
        sessionPath: path,
        connected: connection.status.state === "active",
        status: connection.status.state,
        message: connection.status.message,
        user: connection.user,
        lastValidatedAt: connection.status.lastValidatedAt,
      }));

      if (ctx.json) {
        printJson({
          ok: true,
          sessions: statuses,
        });
        return;
      }

      printStatusTable(
        statuses.map((status) => ({
          platform: status.platform,
          account: status.account,
          status: status.status,
          user: status.user?.username ?? status.user?.displayName,
          message: status.message,
        })),
      );
    });
}
