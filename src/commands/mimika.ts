import { Command } from "commander";

import {
  MIMIKA_SERVER_NAME,
  findMimikaCdpEndpoint,
  isRegisteredWithMimika,
  mimikaMcpStorePath,
  registerWithMimika,
  unregisterFromMimika,
} from "../utils/mimika-bridge.js";
import { printJson } from "../utils/output.js";

/**
 * Connect this mikacli install to a Mimika install on the same machine.
 *
 * Registration writes a row into Mimika's own `mcp.json` rather than going
 * through its `mcp_install` action. That action resolves names against the
 * public MCP registry on purpose, so a model cannot talk it into connecting an
 * arbitrary endpoint — a guard aimed at the model, not at the person who owns
 * both programs. Publishing a localhost server to a public registry to satisfy
 * that check would be the wrong shape entirely.
 */

const DEFAULT_URL = "http://127.0.0.1:8787";
const VERSION = "1.0.1";

export function createMimikaCommand(): Command {
  const mimika = new Command("mimika").description(
    "Connect this mikacli to a local Mimika install",
  );

  mimika
    .command("connect")
    .description("Register mikacli as an MCP server in Mimika's store")
    .option("--url <url>", `Endpoint Mimika should call (default ${DEFAULT_URL})`, DEFAULT_URL)
    .option("--token <token>", "Bearer token, if the server was started with --token")
    .option("--json", "Print the result as JSON")
    .action(async (options: { url?: string; token?: string; json?: boolean }) => {
      const result = await registerWithMimika({
        url: options.url ?? DEFAULT_URL,
        version: VERSION,
        token: options.token,
      });

      if (options.json === true) {
        printJson(result);
        return;
      }

      process.stdout.write(
        [
          `${result.action === "added" ? "Registered" : "Updated"} mikacli in Mimika.`,
          `  store:    ${result.path}`,
          `  name:     ${result.row.name}`,
          `  endpoint: ${result.row.url}`,
          result.row.header_name ? "  auth:     bearer token stored" : "  auth:     none",
          "",
          "Start the server with:  mikacli serve --mcp",
          "Then in Mimika:         /mcp",
          "",
        ].join("\n"),
      );
    });

  mimika
    .command("disconnect")
    .description("Remove mikacli from Mimika's MCP store")
    .option("--json", "Print the result as JSON")
    .action(async (options: { json?: boolean }) => {
      const result = await unregisterFromMimika();
      if (options.json === true) {
        printJson(result);
        return;
      }
      process.stdout.write(
        result.removed
          ? `Removed ${MIMIKA_SERVER_NAME} from ${result.path}.\n`
          : `${MIMIKA_SERVER_NAME} was not registered in ${result.path}.\n`,
      );
    });

  mimika
    .command("status")
    .description("Show whether Mimika can reach mikacli, and whether its browser is available")
    .option("--json", "Print the result as JSON")
    .action(async (options: { json?: boolean }) => {
      const registered = await isRegisteredWithMimika();
      const browser = await findMimikaCdpEndpoint();

      const result = {
        registered,
        store: mimikaMcpStorePath(),
        browser: browser
          ? { available: true, port: browser.port, browser: browser.browser }
          : { available: false },
      };

      if (options.json === true) {
        printJson(result);
        return;
      }

      process.stdout.write(
        [
          `registered: ${registered ? "yes" : "no"}  (${result.store})`,
          browser
            ? `browser:    reachable on port ${browser.port} — ${browser.browser}`
            : "browser:    not reachable — mikacli will open its own when a sign-in needs one",
          "",
          registered ? "" : "Run `mikacli mimika connect` to register.\n",
        ]
          .filter(Boolean)
          .join("\n") + "\n",
      );
    });

  return mimika;
}
