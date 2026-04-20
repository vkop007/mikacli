import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../shared/cookie-login.js";
import { printCookieLlmMediaJobResult, printCookieLlmMediaResult, printCookieLlmStatusResult, printCookieLlmTextResult } from "./output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { AdapterActionResult } from "../../../types.js";
import type { CookieLlmAdapter } from "./base-cookie-llm-adapter.js";

export function createCookieLlmCapabilities(adapter: CookieLlmAdapter): readonly PlatformCapability[] {
  const loginCapability = createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Save the ${adapter.displayName} session for future CLI use. With no auth flags, MikaCLI opens browser login by default`,
    spinnerText: `Saving ${adapter.displayName} session...`,
    successMessage: `${adapter.displayName} session saved.`,
    options: createCookieLoginOptions(),
    action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
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

  const capabilities: PlatformCapability[] = [loginCapability, statusCapability, textCapability, imageCapability, videoCapability];
  const downloadCapableAdapter = adapter as CookieLlmAdapter & Partial<CookieLlmDownloadAdapter>;

  if (typeof downloadCapableAdapter.imageDownload === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "image-download",
        command: "image-download <target>",
        description: `Download or reopen a saved ${adapter.displayName} image job by job ID, conversation ID, or provider output ID`,
        spinnerText: `Downloading the ${adapter.displayName} image...`,
        successMessage: `${adapter.displayName} image download completed.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          { flags: "--output-dir <path>", description: "Directory to write the downloaded image files into" },
        ],
        action: ({ args, options }) =>
          downloadCapableAdapter.imageDownload!({
            account: options.account as string | undefined,
            target: String(args[0] ?? ""),
            outputDir: options.outputDir as string | undefined,
          }),
        onSuccess: printCookieLlmMediaJobResult,
      }),
    );
  }

  if (typeof downloadCapableAdapter.videoDownload === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "video-download",
        command: "video-download <target>",
        description: `Download or reopen a saved ${adapter.displayName} video job by job ID, conversation ID, or provider output ID`,
        spinnerText: `Downloading the ${adapter.displayName} video...`,
        successMessage: `${adapter.displayName} video download completed.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          { flags: "--output-dir <path>", description: "Directory to write the downloaded video into" },
        ],
        action: ({ args, options }) =>
          downloadCapableAdapter.videoDownload!({
            account: options.account as string | undefined,
            target: String(args[0] ?? ""),
            outputDir: options.outputDir as string | undefined,
          }),
        onSuccess: printCookieLlmMediaJobResult,
      }),
    );
  }

  return capabilities;
}

interface CookieLlmDownloadAdapter {
  imageDownload(input: { account?: string; target: string; outputDir?: string }): Promise<AdapterActionResult>;
  videoDownload(input: { account?: string; target: string; outputDir?: string }): Promise<AdapterActionResult>;
}
