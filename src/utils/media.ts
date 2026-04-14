import { readUploadAsset, streamUploadAsset, type UploadAssetKind } from "./upload-pipeline.js";
import type { ReadStream } from "node:fs";

export interface MediaFile {
  filename: string;
  mimeType: string;
  bytes: Buffer;
  kind: UploadAssetKind;
  extension: string;
}

export interface MediaStreamFile extends Omit<MediaFile, "bytes"> {
  stream: ReadStream;
}

export interface ReadMediaFileOptions {
  allowedKinds?: UploadAssetKind[];
}

export async function readMediaFile(path: string, options?: ReadMediaFileOptions): Promise<MediaFile> {
  const file = await readUploadAsset(path, {
    notFoundCode: "MEDIA_NOT_FOUND",
    notFoundMessage: `Media file not found or unreadable: ${path}`,
    allowedKinds: options?.allowedKinds ?? ["image", "video", "audio"],
  });

  return {
    filename: file.filename,
    mimeType: file.mimeType,
    bytes: file.bytes,
    kind: file.kind,
    extension: file.extension,
  };
}

export async function readMediaStream(path: string, options?: ReadMediaFileOptions): Promise<MediaStreamFile> {
  const file = await streamUploadAsset(path, {
    notFoundCode: "MEDIA_NOT_FOUND",
    notFoundMessage: `Media file not found or unreadable: ${path}`,
    allowedKinds: options?.allowedKinds ?? ["image", "video", "audio"],
  });

  return {
    filename: file.filename,
    mimeType: file.mimeType,
    stream: file.stream,
    kind: file.kind,
    extension: file.extension,
  };
}
