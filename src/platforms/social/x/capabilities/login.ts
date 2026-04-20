import type { Command } from "commander";

import { normalizeLoginActionResult } from "../../../../core/runtime/login-result.js";
import { Logger } from "../../../../logger.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../../../../utils/cli.js";

import { xAdapter } from "../adapter.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";

export const xLoginCapability: PlatformCapability = {
  id: "login",
  register(command: Command, definition) {
    const loginCommand = command.command("login").description("Save an X session for future headless use. With no auth flags, MikaCLI opens browser login by default.");

    for (const option of createCookieLoginOptions()) {
      if (option.parser) {
        loginCommand.option(option.flags, option.description, option.parser);
      } else {
        loginCommand.option(option.flags, option.description);
      }
    }

    loginCommand.action(async (options, cmd) => {
        const ctx = resolveCommandContext(cmd);
        const logger = new Logger(ctx);
        const spinner = logger.spinner("Saving X session...");
        await runCommandAction({
          spinner,
          successMessage: "X session saved.",
          action: () => xAdapter.login(resolveCookieLoginInput(options as Record<string, unknown>)),
          onSuccess: (result) => {
            printActionResult(normalizeLoginActionResult(result, definition), ctx.json);
          },
        });
      });
  },
};
