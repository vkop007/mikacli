import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

import { buildQrImageUrl, buildQrShareUrl, normalizeQrText, truncateQrText } from "./helpers.js";

export class QrAdapter {
  readonly platform = "qr" as unknown as Platform;
  readonly displayName = "QR";

  async generate(input: { text: string; size?: number; margin?: number; includeUrl?: boolean }): Promise<AdapterActionResult> {
    const text = normalizeQrText(input.text);
    const shareUrl = buildQrShareUrl(text);
    const size = input.size ?? 6;
    const margin = input.margin ?? 2;

    const ascii = await this.tryFetchAsciiQr(shareUrl);
    const imageUrl = buildQrImageUrl({ text, size, margin });

    return this.buildResult({
      action: "qr",
      message: "Generated a QR code.",
      url: shareUrl,
      data: {
        text,
        shareUrl,
        imageUrl: input.includeUrl ? imageUrl : undefined,
        size,
        margin,
        ascii: ascii ? truncateQrText(ascii) : undefined,
      },
    });
  }

  private async tryFetchAsciiQr(url: string): Promise<string | undefined> {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; AutoCLI/1.0; +https://github.com/)",
          accept: "text/plain,text/*;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return undefined;
      }

      const body = await response.text();
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      const normalized = body.trim().toLowerCase();

      if (contentType.includes("text/html") || normalized.startsWith("<!doctype html") || normalized.startsWith("<html")) {
        return undefined;
      }

      return body;
    } catch {
      return undefined;
    }
  }

  private buildResult(input: {
    action: string;
    message: string;
    url: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      url: input.url,
      data: input.data,
    };
  }
}

export const qrAdapter = new QrAdapter();
