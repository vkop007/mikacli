import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, extname } from "node:path";

import { AutoCliError } from "../errors.js";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export interface MediaFile {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}

export async function readMediaFile(path: string): Promise<MediaFile> {
  await access(path, constants.R_OK).catch(() => {
    throw new AutoCliError("MEDIA_NOT_FOUND", `Media file not found or unreadable: ${path}`, {
      details: { path },
    });
  });

  const extension = extname(path).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];

  if (!mimeType) {
    throw new AutoCliError("UNSUPPORTED_MEDIA_TYPE", `Unsupported media type: ${extension || "unknown"}`, {
      details: {
        path,
        supportedExtensions: Object.keys(MIME_BY_EXTENSION),
      },
    });
  }

  return {
    filename: basename(path),
    mimeType,
    bytes: await readFile(path),
  };
}
