import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { printCookieLlmMediaResult, printCookieLlmStatusResult, printCookieLlmTextResult } from "./output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { CookieLlmAdapter } from "./base-cookie-llm-adapter.js";

export function createCookieLlmCapabilities(adapter: CookieLlmAdapter): readonly PlatformCapability[] {
  const loginCapability = createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Import cookies and save the ${adapter.displayName} session for future CLI use`,
    spinnerText: `Importing ${adapter.displayName} session...`,
    successMessage: `${adapter.displayName} session imported.`,
    options: [
      { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
      { flags: "--account <name>", description: "Optional saved alias instead of the default session name" },
      { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
      { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
    ],
    action: ({ options }) =>
      adapter.login({
        account: options.account as string | undefined,
        cookieFile: options.cookies as string | undefined,
        cookieString: options.cookieString as string | undefined,
        cookieJson: options.cookieJson as string | undefined,
      }),
  });

  const statusCapability = createAdapterActionCapability({
    id: "status",
    command: "status",
    description: `Show the saved ${adapter.displayName} cookie-session status`,
    spinnerText: `Checking ${adapter.displayName} session status...`,
    successMessage: `${adapter.displayName} status loaded.`,
    options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
    action: ({ options }) => adapter.statusAction(options.account as string | undefined),
    onSuccess: printCookieLlmStatusResult,
  });

  const textCapability = createAdapterActionCapability({
    id: "text",
    command: "text <prompt...>",
    description: `Send a text prompt to ${adapter.displayName}`,
    spinnerText: `Sending ${adapter.displayName} text prompt...`,
    successMessage: `${adapter.displayName} text prompt completed.`,
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
    description: `Send an image plus optional caption or instruction to ${adapter.displayName}`,
    spinnerText: `Sending ${adapter.displayName} image prompt...`,
    successMessage: `${adapter.displayName} image prompt completed.`,
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
    description: `Send a video-generation prompt to ${adapter.displayName}`,
    spinnerText: `Sending ${adapter.displayName} video prompt...`,
    successMessage: `${adapter.displayName} video prompt completed.`,
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
