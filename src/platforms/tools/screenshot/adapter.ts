import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { ensureParentDirectory, getCachePath } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";
import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type ScreenshotInput = {
  target: string;
  output?: string;
  outputDir?: string;
  timeoutMs?: number;
};

type MicrolinkScreenshotPayload = {
  screenshotUrl: string;
  width?: number;
  height?: number;
  type?: string;
  size?: number;
  sourceUrl: string;
};

export class ScreenshotAdapter {
  readonly platform: Platform = "screenshot" as Platform;
  readonly displayName = "Screenshot";

  async screenshot(input: ScreenshotInput): Promise<AdapterActionResult> {
    const target = normalizePublicHttpUrl(input.target);
    const timeoutMs = clampNumber(input.timeoutMs ?? 25000, 3000, 90000);

    const payload = await fetchScreenshotMetadata(target, timeoutMs);
    const imageResponse = await fetchScreenshotBinary(payload.screenshotUrl, timeoutMs);
    const extension = resolveExtension(payload.type, imageResponse.contentType, payload.screenshotUrl);
    const outputPath = resolveOutputPath({
      sourceUrl: payload.sourceUrl,
      extension,
      output: input.output,
      outputDir: input.outputDir,
    });

    await ensureParentDirectory(outputPath);
    await writeFile(outputPath, imageResponse.buffer);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "screenshot",
      message: `Saved screenshot for ${new URL(payload.sourceUrl).hostname}.`,
      url: payload.sourceUrl,
      data: {
        target,
        sourceUrl: payload.sourceUrl,
        screenshotUrl: payload.screenshotUrl,
        width: payload.width ?? null,
        height: payload.height ?? null,
        contentType: imageResponse.contentType ?? payload.type ?? null,
        sizeBytes: imageResponse.buffer.length || payload.size || null,
        outputPath,
        provider: "microlink",
      },
    };
  }
}

export const screenshotAdapter = new ScreenshotAdapter();

async function fetchScreenshotMetadata(target: string, timeoutMs: number): Promise<MicrolinkScreenshotPayload> {
  const url = new URL("https://api.microlink.io/");
  url.searchParams.set("url", target);
  url.searchParams.set("screenshot", "true");
  url.searchParams.set("meta", "false");

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new MikaCliError("SCREENSHOT_METADATA_FAILED", "Unable to reach the screenshot service.", {
      details: {
        target,
      },
      cause: error,
    });
  }

  if (!response.ok) {
    throw new MikaCliError(
      "SCREENSHOT_METADATA_FAILED",
      `Screenshot service returned ${response.status} ${response.statusText}.`,
      {
        details: {
          target,
          status: response.status,
        },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new MikaCliError("SCREENSHOT_METADATA_INVALID", "Screenshot service returned invalid JSON.", {
      cause: error,
    });
  }

  return parseMicrolinkScreenshotResponse(payload);
}

async function fetchScreenshotBinary(
  screenshotUrl: string,
  timeoutMs: number,
): Promise<{ buffer: Uint8Array; contentType: string | null }> {
  let response: Response;
  try {
    response = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "image/*",
        "user-agent": "Mozilla/5.0 (compatible; MikaCLI/1.0; +https://github.com/)",
      },
    });
  } catch (error) {
    throw new MikaCliError("SCREENSHOT_DOWNLOAD_FAILED", "Unable to download the generated screenshot image.", {
      details: {
        screenshotUrl,
      },
      cause: error,
    });
  }

  if (!response.ok) {
    throw new MikaCliError(
      "SCREENSHOT_DOWNLOAD_FAILED",
      `Screenshot image download failed with ${response.status} ${response.statusText}.`,
      {
        details: {
          screenshotUrl,
          status: response.status,
        },
      },
    );
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  return {
    buffer,
    contentType: normalizeOptionalString(response.headers.get("content-type")),
  };
}

export function parseMicrolinkScreenshotResponse(payload: unknown): MicrolinkScreenshotPayload {
  if (!payload || typeof payload !== "object") {
    throw new MikaCliError("SCREENSHOT_METADATA_INVALID", "Screenshot service payload was not an object.");
  }

  const root = payload as Record<string, unknown>;
  const status = typeof root.status === "string" ? root.status : "";
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;
  const screenshot = data?.screenshot && typeof data.screenshot === "object"
    ? (data.screenshot as Record<string, unknown>)
    : null;
  const screenshotUrl = typeof screenshot?.url === "string" ? screenshot.url.trim() : "";
  const sourceUrl = typeof data?.url === "string" ? data.url.trim() : "";

  if (status !== "success" || !screenshotUrl || !sourceUrl) {
    throw new MikaCliError("SCREENSHOT_METADATA_INVALID", "Screenshot service did not return a usable screenshot URL.");
  }

  return {
    screenshotUrl,
    sourceUrl,
    width: typeof screenshot?.width === "number" ? screenshot.width : undefined,
    height: typeof screenshot?.height === "number" ? screenshot.height : undefined,
    type: typeof screenshot?.type === "string" ? screenshot.type : undefined,
    size: typeof screenshot?.size === "number" ? screenshot.size : undefined,
  };
}

function resolveOutputPath(input: {
  sourceUrl: string;
  extension: string;
  output?: string;
  outputDir?: string;
}): string {
  if (input.output) {
    return input.output;
  }

  const hostname = new URL(input.sourceUrl).hostname.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "") || "site";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${hostname}-${timestamp}.${input.extension}`;

  if (input.outputDir) {
    return join(input.outputDir, filename);
  }

  return getCachePath("public", "screenshot", filename);
}

function resolveExtension(
  declaredType: string | undefined,
  contentType: string | null,
  screenshotUrl: string,
): string {
  const type = `${declaredType ?? ""} ${contentType ?? ""}`.toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) {
    return "jpg";
  }

  if (type.includes("webp")) {
    return "webp";
  }

  const urlExtension = extname(new URL(screenshotUrl).pathname).replace(/^\./, "").toLowerCase();
  if (urlExtension) {
    return urlExtension;
  }

  return "png";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeOptionalString(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
