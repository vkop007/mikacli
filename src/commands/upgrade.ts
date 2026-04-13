import { spawn } from "node:child_process";
import { Command } from "commander";
import pc from "picocolors";
import { Logger } from "../logger.js";
import { resolveCommandContext } from "../utils/cli.js";

export function createUpgradeCommand(): Command {
  return new Command("upgrade")
    .description("Self-update AutoCLI to the latest npm version")
    .action(async (_options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Upgrading AutoCLI to the latest version...");

      return new Promise<void>((resolve, reject) => {
        // Detect current runtime to choose package manager
        // @ts-ignore - process.versions.bun is injected by bun
        const isBun = Boolean(process.versions?.bun);
        
        // npm is universally safe and likely what they used to install globally if not bun
        const commandStr = isBun ? "bun" : "npm";
        const args = isBun 
           ? ["add", "--global", "@vk007/autocli@latest"] 
           : ["install", "-g", "@vk007/autocli@latest"];
        
        const child = spawn(commandStr, args, { 
            stdio: "ignore", // standard npm install can be noisy, keep it clean
            shell: process.platform === "win32" 
        });

        child.on("close", (code) => {
          if (code === 0) {
            spinner?.succeed(pc.green("Successfully upgraded AutoCLI to the latest version."));
            resolve();
          } else {
            spinner?.fail(pc.red(`Upgrade failed with exit code ${code}. Try running manually:\n> ${commandStr} ${args.join(" ")}`));
            
            // Resolve instead of throwing a hard uncaught error to gracefully exit the commander flow
            resolve();
          }
        });

        child.on("error", (error) => {
          spinner?.fail(pc.red(`Failed to trigger upgrade command: ${error.message}`));
          resolve();
        });
      });
    });
}
