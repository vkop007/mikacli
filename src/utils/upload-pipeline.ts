import { access, readFile, stat } from "node:fs/promises";
import { constants, createReadStream, type ReadStream } from "node:fs";
import { basename, extname } from "node:path";

import { MikaCliError } from "../errors.js";

export type UploadAssetKind = "image" | "video" | "audio" | "text" | "document" | "archive" | "binary";

export interface UploadAsset {
  path: string;
  filename: string;
  extension: string;
  mimeType: string;
  kind: UploadAssetKind;
  bytes: Buffer;
  size: number;
  sizeBytes: number;
}

export interface StreamUploadAsset extends Omit<UploadAsset, "bytes"> {
  stream: ReadStream;
}

export interface ReadUploadAssetOptions {
  mimeType?: string;
  notFoundCode?: string;
  notFoundMessage?: string;
  unsupportedCode?: string;
  unsupportedMessage?: string;
  allowedKinds?: UploadAssetKind[];
  details?: Record<string, unknown>;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".aac": "audio/aac",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".m4a": "audio/mp4",
  ".md": "text/markdown",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".zip": "application/zip",
};

export async function readUploadAsset(path: string, options: ReadUploadAssetOptions = {}): Promise<UploadAsset> {
  const trimmed = path.trim();

  await access(trimmed, constants.R_OK).catch(() => {
    throw new MikaCliError(
      options.notFoundCode ?? "FILE_NOT_FOUND",
      options.notFoundMessage ?? `File not found or unreadable: ${trimmed}`,
      {
        details: {
          path: trimmed,
          ...(options.details ?? {}),
        },
      },
    );
  });

  const bytes = await readFile(trimmed);
  const extension = extname(trimmed).toLowerCase();
  const mimeType = normalizeMimeType(options.mimeType) ?? MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
  const asset: UploadAsset = {
    path: trimmed,
    filename: basename(trimmed),
    extension,
    mimeType,
    kind: detectUploadAssetKind(mimeType),
    bytes,
    size: bytes.byteLength,
    sizeBytes: bytes.byteLength,
  };

  if (options.allowedKinds && options.allowedKinds.length > 0 && !options.allowedKinds.includes(asset.kind)) {
    throw new MikaCliError(
      options.unsupportedCode ?? "UNSUPPORTED_MEDIA_TYPE",
      options.unsupportedMessage ?? `Unsupported upload asset kind: ${asset.kind}`,
      {
        details: {
          path: trimmed,
          mimeType: asset.mimeType,
          kind: asset.kind,
          allowedKinds: options.allowedKinds,
          ...(options.details ?? {}),
        },
      },
    );
  }

  return asset;
}

export async function streamUploadAsset(path: string, options: ReadUploadAssetOptions = {}): Promise<StreamUploadAsset> {
  const trimmed = path.trim();

  await access(trimmed, constants.R_OK).catch(() => {
    throw new MikaCliError(
      options.notFoundCode ?? "FILE_NOT_FOUND",
      options.notFoundMessage ?? `File not found or unreadable: ${trimmed}`,
      {
        details: {
          path: trimmed,
          ...(options.details ?? {}),
        },
      },
    );
  });

  const fileStat = await stat(trimmed);
  const extension = extname(trimmed).toLowerCase();
  const mimeType = normalizeMimeType(options.mimeType) ?? MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
  const kind = detectUploadAssetKind(mimeType);

  if (options.allowedKinds && options.allowedKinds.length > 0 && !options.allowedKinds.includes(kind)) {
    throw new MikaCliError(
      options.unsupportedCode ?? "UNSUPPORTED_MEDIA_TYPE",
      options.unsupportedMessage ?? `Unsupported upload asset kind: ${kind}`,
      {
        details: {
          path: trimmed,
          mimeType,
          kind,
          allowedKinds: options.allowedKinds,
          ...(options.details ?? {}),
        },
      },
    );
  }

  return {
    path: trimmed,
    filename: basename(trimmed),
    extension,
    mimeType,
    kind,
    stream: createReadStream(trimmed),
    size: fileStat.size,
    sizeBytes: fileStat.size,
  };
}

export function detectUploadAssetKind(mimeType: string): UploadAssetKind {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) {
    return "image";
  }
  if (normalized.startsWith("video/")) {
    return "video";
  }
  if (normalized.startsWith("audio/")) {
    return "audio";
  }
  if (normalized.startsWith("text/")) {
    return "text";
  }
  if (normalized === "application/pdf" || normalized === "application/json" || normalized === "text/markdown") {
    return "document";
  }
  if (normalized === "application/zip") {
    return "archive";
  }
  return "binary";
}

export function createUploadBlob(asset: Pick<UploadAsset, "bytes" | "mimeType">): Blob {
  return new Blob([new Uint8Array(asset.bytes)], { type: asset.mimeType });
}

export function createUploadFile(asset: Pick<UploadAsset, "bytes" | "mimeType" | "filename">): File {
  return new File([new Uint8Array(asset.bytes)], asset.filename, { type: asset.mimeType });
}

export function appendUploadFileField(
  form: FormData,
  fieldName: string,
  asset: Pick<UploadAsset, "bytes" | "mimeType" | "filename">,
  filename = asset.filename,
): void {
  form.append(fieldName, createUploadBlob(asset), filename);
}

export function buildMultipartRelatedUpload(input: {
  metadata: Record<string, unknown>;
  asset: Pick<UploadAsset, "bytes" | "mimeType">;
  boundaryPrefix?: string;
}): {
  body: Buffer;
  boundary: string;
  contentType: string;
} {
  const boundary = `${input.boundaryPrefix ?? "mikacli-upload"}-${Date.now()}`;
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(input.metadata)}\r\n--${boundary}\r\nContent-Type: ${input.asset.mimeType}\r\n\r\n`,
    "utf8",
  );
  const suffix = Buffer.from(`\r\n--${boundary}--`, "utf8");

  return {
    body: Buffer.concat([prefix, input.asset.bytes, suffix]),
    boundary,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

export function detectMimeTypeFromPath(path: string, override?: string): string {
  return normalizeMimeType(override) ?? MIME_BY_EXTENSION[extname(path).toLowerCase()] ?? "application/octet-stream";
}

function normalizeMimeType(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
