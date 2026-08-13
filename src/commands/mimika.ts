import { Command } from "commander";

import { MikaCliError } from "../errors.js";
import {
  MIMIKA_BROWSER_PROTOCOL,
  MIMIKA_BROWSER_PROTOCOL_VERSION,
  MimikaBrowserGatewayClient,
  hasMimikaBrowserGatewayEnvironment,
  isMimikaManagedMode,
} from "../utils/mimika-browser-client.js";
import { printJson } from "../utils/output.js";

export function createMimikaCommand(): Command {
  const mimika = new Command("mimika").description(
    "Inspect the Mimika-managed MikaCLI integration",
  );

  mimika
    .command("connect")
    .description("Deprecated: Mimika provisions its managed MikaCLI connection")
    .action(() => {
      throw lifecycleOwnedError("connect");
    });

  mimika
    .command("disconnect")
    .description("Deprecated: Mimika removes its managed MikaCLI connection")
    .action(() => {
      throw lifecycleOwnedError("disconnect");
    });

  mimika
    .command("status")
    .description("Show managed-mode and Mimika browser-broker status")
    .option("--json", "Print the result as JSON")
    .action(async function statusAction(this: Command) {
      const options = this.optsWithGlobals<{ json?: boolean }>();
      const gatewayConfigured = hasMimikaBrowserGatewayEnvironment();
      const managed = isMimikaManagedMode();
      const result = gatewayConfigured
        ? {
            managed,
            lifecycle: "mimika-owned" as const,
            registration: "managed-by-mimika" as const,
            gatewayConfigured: true,
            browser: await MimikaBrowserGatewayClient.fromEnvironment().getCapabilities(),
          }
        : {
            managed,
            lifecycle: "mimika-owned" as const,
            registration: "managed-by-mimika" as const,
            gatewayConfigured: false,
            browser: {
              status: "unavailable" as const,
              protocol: MIMIKA_BROWSER_PROTOCOL,
              protocol_version: MIMIKA_BROWSER_PROTOCOL_VERSION,
              reason: "Mimika browser gateway environment is not configured for this process.",
            },
          };

      if (options.json === true) {
        printJson(result);
        return;
      }

      process.stdout.write(
        [
          `managed:     ${managed ? "yes" : "no"}`,
          "lifecycle:   owned by Mimika",
          `gateway:     ${gatewayConfigured ? "configured" : "not configured"}`,
          gatewayConfigured && "capabilities" in result.browser
            ? `browser:     ${result.browser.browser.connected ? "connected" : "not connected"} (${result.browser.browser.backend})`
            : "browser:     unavailable",
          "",
        ].join("\n"),
      );
    });

  return mimika;
}

function lifecycleOwnedError(action: "connect" | "disconnect"): MikaCliError {
  return new MikaCliError(
    "MIMIKA_LIFECYCLE_OWNED",
    `\`mikacli mimika ${action}\` is disabled. Mimika installs, authenticates, registers, updates, and removes its managed MikaCLI sidecar through the plugin lifecycle.`,
    {
      details: {
        action,
        owner: "mimika",
        directStoreWrites: false,
        portScanning: false,
      },
    },
  );
}
