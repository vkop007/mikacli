import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import {
  printCookieLlmMediaJobResult,
  printCookieLlmMediaResult,
  printCookieLlmStatusResult,
  printCookieLlmTextResult,
} from "../shared/output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { GrokAdapter } from "./adapter.js";

export function createGrokCapabilities(adapter: GrokAdapter): readonly PlatformCapability[] {
  const loginCapability = createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Import cookies and save the Grok session for future CLI use",
    spinnerText: "Importing Grok session...",
    successMessage: "Grok session imported.",
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
    description: "Show the saved Grok cookie-session status",
    spinnerText: "Checking Grok session status...",
    successMessage: "Grok status loaded.",
    options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
    action: ({ options }) => adapter.statusAction(options.account as string | undefined),
    onSuccess: printCookieLlmStatusResult,
  });

  const textCapability = createAdapterActionCapability({
    id: "text",
    command: "text <prompt...>",
    description: "Send a text prompt to Grok",
    spinnerText: "Sending Grok text prompt...",
    successMessage: "Grok text prompt completed.",
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
    command: "image <prompt...>",
    description: "Generate Grok images from a text prompt",
    spinnerText: "Generating Grok image...",
    successMessage: "Grok image generation completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--model <name>", description: "Optional provider model or mode hint" },
    ],
    action: ({ args, options }) =>
      adapter.generateImage({
        account: options.account as string | undefined,
        model: options.model as string | undefined,
        prompt: args.map(String).join(" ").trim(),
    }),
    onSuccess: printCookieLlmMediaResult,
  });

  const imageDownloadCapability = createAdapterActionCapability({
    id: "image-download",
    command: "image-download <target>",
    description: "Download or reopen a saved Grok image job by job ID, conversation ID, or response ID",
    spinnerText: "Downloading the Grok image...",
    successMessage: "Grok image download completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--output-dir <path>", description: "Directory to write the downloaded image files into" },
    ],
    action: ({ args, options }) =>
      adapter.imageDownload({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
        outputDir: options.outputDir as string | undefined,
      }),
    onSuccess: printCookieLlmMediaJobResult,
  });

  const videoCapability = createAdapterActionCapability({
    id: "video",
    command: "video <prompt...>",
    description: "Generate a Grok video from a text prompt",
    spinnerText: "Generating Grok video...",
    successMessage: "Grok video generation completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--model <name>", description: "Optional provider model or mode hint" },
    ],
    action: ({ args, options }) =>
      adapter.generateVideo({
        account: options.account as string | undefined,
        model: options.model as string | undefined,
        prompt: args.map(String).join(" ").trim(),
      }),
    onSuccess: printCookieLlmMediaResult,
  });

  const videoStatusCapability = createAdapterActionCapability({
    id: "video-status",
    command: "video-status <target>",
    description: "Load the current status for a saved Grok video job by job ID, conversation ID, or provider video ID",
    spinnerText: "Checking Grok video job status...",
    successMessage: "Grok video job status loaded.",
    options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
    action: ({ args, options }) =>
      adapter.videoStatus({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
    onSuccess: printCookieLlmMediaJobResult,
  });

  const videoWaitCapability = createAdapterActionCapability({
    id: "video-wait",
    command: "video-wait <target>",
    description: "Wait for a Grok video job to finish and expose its downloadable asset URL",
    spinnerText: "Waiting for the Grok video job...",
    successMessage: "Grok video wait completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--timeout <seconds>", description: "Maximum seconds to wait before returning", parser: parsePositiveSeconds },
      { flags: "--interval <seconds>", description: "Polling interval in seconds", parser: parsePositiveSeconds },
    ],
    action: ({ args, options }) =>
      adapter.videoWait({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
        timeoutMs: typeof options.timeout === "number" ? (options.timeout as number) * 1000 : undefined,
        intervalMs: typeof options.interval === "number" ? (options.interval as number) * 1000 : undefined,
      }),
    onSuccess: printCookieLlmMediaJobResult,
  });

  const videoDownloadCapability = createAdapterActionCapability({
    id: "video-download",
    command: "video-download <target>",
    description: "Download a completed Grok video job by job ID, conversation ID, or provider video ID",
    spinnerText: "Downloading the Grok video...",
    successMessage: "Grok video download completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--output-dir <path>", description: "Directory to write the downloaded video into" },
    ],
    action: ({ args, options }) =>
      adapter.videoDownload({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
        outputDir: options.outputDir as string | undefined,
      }),
    onSuccess: printCookieLlmMediaJobResult,
  });

  const videoCancelCapability = createAdapterActionCapability({
    id: "video-cancel",
    command: "video-cancel <target>",
    description: "Request cancellation for a currently inflight Grok video job",
    spinnerText: "Requesting Grok video cancellation...",
    successMessage: "Grok video cancellation request completed.",
    options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
    action: ({ args, options }) =>
      adapter.videoCancel({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
      }),
    onSuccess: printCookieLlmMediaJobResult,
  });

  return [
    loginCapability,
    statusCapability,
    textCapability,
    imageCapability,
    imageDownloadCapability,
    videoCapability,
    videoStatusCapability,
    videoWaitCapability,
    videoDownloadCapability,
    videoCancelCapability,
  ] as const;
}

function parsePositiveSeconds(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer.");
  }

  return parsed;
}
