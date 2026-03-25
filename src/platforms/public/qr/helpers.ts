import { AutoCliError } from "../../../errors.js";

export const QR_SHARE_BASE_URL = "https://qrenco.de";
export const QR_IMAGE_BASE_URL = "https://quickchart.io/qr";
export const QR_DEFAULT_SIZE = 6;
export const QR_DEFAULT_MARGIN = 2;
export const QR_TEXT_LIMIT = 4000;

export function normalizeQrText(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AutoCliError("QR_TEXT_REQUIRED", "Provide text to encode as a QR code.");
  }

  return normalized;
}

export function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AutoCliError("QR_INVALID_NUMBER", `Invalid ${label} "${value}". Expected a positive integer.`);
  }

  return parsed;
}

export function buildQrShareUrl(text: string): string {
  return `${QR_SHARE_BASE_URL}/${encodeURIComponent(text)}`;
}

export function buildQrImageUrl(input: { text: string; size: number; margin: number }): string {
  return `${QR_IMAGE_BASE_URL}?text=${encodeURIComponent(input.text)}&size=${scaleQrSize(input.size)}&margin=${input.margin}`;
}

export function truncateQrText(value: string, limit = QR_TEXT_LIMIT): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 16)).trimEnd()}\n... [truncated]`;
}

export function scaleQrSize(size: number): number {
  return Math.max(1, size) * 50;
}

