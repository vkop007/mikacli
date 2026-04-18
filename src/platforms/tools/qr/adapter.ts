import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";
import { readFile } from "fs/promises";

import { buildQrImageUrl, buildQrShareUrl, normalizeQrText, truncateQrText } from "./helpers.js";

type DecodeInput = {
  filePath: string;
};

type DecodeResult = {
  text: string;
  location?: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
  };
};

type JsQrResult = {
  data: string;
  location?: DecodeResult["location"];
};

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

  async decode(input: DecodeInput): Promise<AdapterActionResult> {
    try {
      const fileBuffer = await readFile(input.filePath);
      const result = await this.decodeQrFromBuffer(fileBuffer);

      if (!result) {
        throw new AutoCliError("QR_DECODE_FAILED", "No QR code found in the image.");
      }

      return this.buildDecodeResult({
        action: "decode",
        message: "Decoded QR code.",
        data: {
          text: result.text,
          location: result.location,
        },
      });
    } catch (error) {
      if (error instanceof AutoCliError) {
        throw error;
      }
      throw new AutoCliError("QR_DECODE_ERROR", "Failed to decode QR code from image.", {
        cause: error,
        details: { filePath: input.filePath },
      });
    }
  }

  private async decodeQrFromBuffer(buffer: Buffer): Promise<DecodeResult | null> {
    try {
      // Dynamic import for jsQR to avoid adding it as a static dependency initially
      const jsQrModule = await import("jsqr");
      const jsQR = ((jsQrModule as unknown as { default?: unknown }).default ?? jsQrModule) as (
        data: Uint8ClampedArray,
        width: number,
        height: number,
      ) => JsQrResult | null;
      const Jimp = (await import("jimp")).default;

      const image = await Jimp.read(buffer);
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      const imageData = {
        data: new Uint8ClampedArray(image.bitmap.data),
        width,
        height,
      };

      const result = jsQR(imageData.data, width, height);

      if (!result) {
        return null;
      }

      return {
        text: result.data,
        location: result.location,
      };
    } catch (error) {
      // Fallback: try to provide helpful error message
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AutoCliError("FILE_NOT_FOUND", `File not found: ${(error as NodeJS.ErrnoException).path}`, {
          cause: error,
        });
      }
      throw error;
    }
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

  private buildDecodeResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const qrAdapter = new QrAdapter();
