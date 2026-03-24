import { Command } from "commander";

import { getAllAdapters } from "../adapters/index.js";
import { CookieManager } from "../utils/cookie-manager.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson, printStatusTable } from "../utils/output.js";

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Show all connected accounts and their session status")
    .action(async function statusAction(this: Command) {
      const ctx = resolveCommandContext(this);
      const cookieManager = new CookieManager();
      const sessions = await cookieManager.listSessions();
      const adapters = new Map(getAllAdapters().map((adapter) => [adapter.platform, adapter]));
      const statuses = await Promise.all(
        sessions.map(async ({ session, path }) => {
          const adapter = adapters.get(session.platform);
          if (!adapter) {
            return {
              platform: session.platform,
              account: session.account,
              sessionPath: path,
              connected: false,
              status: "unknown" as const,
              message: "No adapter registered for this platform.",
              user: session.user,
            };
          }

          return adapter.getStatus(session.account);
        }),
      );

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
