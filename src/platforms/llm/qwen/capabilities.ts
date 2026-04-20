import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../shared/cookie-login.js";
import { printCookieLlmStatusResult, printCookieLlmTextResult } from "../shared/output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { QwenAdapter } from "./adapter.js";

export function createQwenCapabilities(adapter: QwenAdapter): readonly PlatformCapability[] {
  const loginCapability = createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Save the Qwen session for future CLI use. With no auth flags, MikaCLI opens browser login by default",
    spinnerText: "Saving Qwen session...",
    successMessage: "Qwen session saved.",
    options: createCookieLoginOptions([{ flags: "--token <value>", description: "Optional bearer token if the cookie export does not include the token cookie" }]),
    action: ({ options }) =>
      adapter.login({
        ...resolveCookieLoginInput(options),
        token: options.token as string | undefined,
      }),
  });

  const statusCapability = createAdapterActionCapability({
    id: "status",
    command: "status",
    description: "Show the saved Qwen cookie-session status",
    spinnerText: "Checking Qwen session status...",
    successMessage: "Qwen status loaded.",
    options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
    action: ({ options }) => adapter.statusAction(options.account as string | undefined),
    onSuccess: printCookieLlmStatusResult,
  });

  const textCapability = createAdapterActionCapability({
    id: "text",
    command: "text <prompt...>",
    description: "Send a text prompt to Qwen",
    spinnerText: "Sending Qwen text prompt...",
    successMessage: "Qwen text prompt completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--model <name>", description: "Optional Qwen model name" },
    ],
    action: ({ args, options }) =>
      adapter.text({
        account: options.account as string | undefined,
        model: options.model as string | undefined,
        prompt: args.map(String).join(" ").trim(),
      }),
    onSuccess: printCookieLlmTextResult,
  });

  return [loginCapability, statusCapability, textCapability] as const;
}
