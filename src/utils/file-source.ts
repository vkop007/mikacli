import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, extname } from "node:path";

import { AutoCliError } from "../errors.js";

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

export interface UploadFileSource {
  path: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  size: number;
}

export async function readUploadFile(path: string): Promise<UploadFileSource> {
  const trimmed = path.trim();

  await access(trimmed, constants.R_OK).catch(() => {
    throw new AutoCliError("FILE_NOT_FOUND", `File not found or unreadable: ${trimmed}`, {
      details: {
        path: trimmed,
      },
    });
  });

  const bytes = await readFile(trimmed);
  return {
    path: trimmed,
    filename: basename(trimmed),
    mimeType: MIME_BY_EXTENSION[extname(trimmed).toLowerCase()] ?? "application/octet-stream",
    size: bytes.byteLength,
    bytes,
  };
}
