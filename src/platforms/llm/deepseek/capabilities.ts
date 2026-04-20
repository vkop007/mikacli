import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../shared/cookie-login.js";
import { printCookieLlmMediaResult, printCookieLlmStatusResult, printCookieLlmTextResult } from "../shared/output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { CookieLlmAdapter } from "../shared/base-cookie-llm-adapter.js";

export function createDeepSeekCapabilities(adapter: CookieLlmAdapter): readonly PlatformCapability[] {
  const loginCapability = createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Save the DeepSeek session for future CLI use. With no auth flags, MikaCLI opens browser login by default",
    spinnerText: "Saving DeepSeek session...",
    successMessage: "DeepSeek session saved.",
    options: createCookieLoginOptions([{ flags: "--token <value>", description: "DeepSeek userToken from localStorage", required: false }]),
    action: ({ options }) =>
      adapter.login({
        ...resolveCookieLoginInput(options),
        token: options.token as string | undefined,
      }),
  });

  const statusCapability = createAdapterActionCapability({
    id: "status",
    command: "status",
    description: "Show the saved DeepSeek cookie-session status",
    spinnerText: "Checking DeepSeek session status...",
    successMessage: "DeepSeek status loaded.",
    options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
    action: ({ options }) => adapter.statusAction(options.account as string | undefined),
    onSuccess: printCookieLlmStatusResult,
  });

  const textCapability = createAdapterActionCapability({
    id: "text",
    command: "text <prompt...>",
    description: "Send a text prompt to DeepSeek",
    spinnerText: "Sending DeepSeek text prompt...",
    successMessage: "DeepSeek text prompt completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--model <name>", description: "Optional provider model or mode hint" },
    ],
    action: ({ args, options }) =>
      adapter.text({
        account: options.account as string | undefined,
        model: options.model as string | undefined,
        prompt: args.map(String).join(" ").trim(),
      }),
    onSuccess: printCookieLlmTextResult,
  });

  const imageCapability = createAdapterActionCapability({
    id: "image",
    command: "image <mediaPath>",
    description: "Send an image plus optional caption or instruction to DeepSeek",
    spinnerText: "Sending DeepSeek image prompt...",
    successMessage: "DeepSeek image prompt completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--caption <text>", description: "Optional instruction, caption, or edit prompt" },
      { flags: "--model <name>", description: "Optional provider model or mode hint" },
    ],
    action: ({ args, options }) =>
      adapter.image({
        account: options.account as string | undefined,
        caption: options.caption as string | undefined,
        model: options.model as string | undefined,
        mediaPath: String(args[0] ?? ""),
      }),
    onSuccess: printCookieLlmMediaResult,
  });

  const videoCapability = createAdapterActionCapability({
    id: "video",
    command: "video <prompt...>",
    description: "Send a video-generation prompt to DeepSeek",
    spinnerText: "Sending DeepSeek video prompt...",
    successMessage: "DeepSeek video prompt completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--model <name>", description: "Optional provider model or mode hint" },
    ],
    action: ({ args, options }) =>
      adapter.video({
        account: options.account as string | undefined,
        model: options.model as string | undefined,
        prompt: args.map(String).join(" ").trim(),
      }),
    onSuccess: printCookieLlmMediaResult,
  });

  return [loginCapability, statusCapability, textCapability, imageCapability, videoCapability] as const;
}
