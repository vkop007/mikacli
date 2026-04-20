import { Command } from "commander";

import { getBrowserProfileDir } from "../config.js";
import { parseBrowserTimeoutSeconds } from "../platforms/shared/cookie-login.js";
import { resolveCommandContext } from "../utils/cli.js";
import { printJson } from "../utils/output.js";
import { openSharedBrowserProfile } from "../utils/browser-cookie-login.js";

export function createLoginCommand(): Command {
  return new Command("login")
    .description("Open the shared MikaCLI browser profile so future provider logins can reuse your SSO and browser sessions")
    .option("--browser", "Open the shared browser profile for manual sign-in")
    .option("--url <url>", "Optional start URL for the shared browser profile")
    .option("--browser-timeout <seconds>", "Maximum seconds to keep the shared browser open before timing out (default: 600)", parseBrowserTimeoutSeconds)
    .addHelpText(
      "after",
      `
Examples:
  mikacli login
  mikacli login --browser
  mikacli login --url https://accounts.google.com/
  mikacli login --browser --url https://accounts.google.com/ --browser-timeout 900
`,
    )
    .action(async function loginAction(this: Command) {
      const ctx = resolveCommandContext(this);
      const options = this.optsWithGlobals<{
        browser?: boolean;
        url?: string;
        browserTimeout?: number;
      }>();

      const result = await openSharedBrowserProfile({
        browserUrl: options.url,
        timeoutSeconds: options.browserTimeout,
      });

      const payload = {
        ok: true,
        action: "login",
        mode: "browser",
        browserProfilePath: result.browserProfilePath,
        startUrl: result.startUrl,
        timedOut: result.timedOut,
        detected: result.detected,
        detector: result.detector,
        finalUrl: result.finalUrl,
        nextSteps: [
          "mikacli developer github login --browser",
          "mikacli social reddit login --browser",
          "mikacli llm chatgpt login --browser",
        ],
        message: result.detected
          ? `Shared MikaCLI browser profile auto-detected a ready ${result.detector ?? "browser"} login and saved it at ${result.browserProfilePath}.`
          : result.timedOut
            ? `Shared MikaCLI browser profile stayed open for the full timeout. Profile remains saved at ${getBrowserProfileDir()}.`
            : `Shared MikaCLI browser profile is ready for reuse at ${result.browserProfilePath}.`,
      };

      if (ctx.json) {
        printJson(payload);
        return;
      }

      console.log(payload.message);
      console.log(`profile: ${payload.browserProfilePath}`);
      console.log(`url: ${payload.startUrl}`);
      if (payload.detected && payload.finalUrl) {
        console.log(`detected-url: ${payload.finalUrl}`);
      }
      console.log(`next: ${payload.nextSteps[0]}`);
    });
}
