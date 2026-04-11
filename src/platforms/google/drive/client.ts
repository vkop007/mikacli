import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";

import { GoogleApiClient } from "../shared/client.js";

export interface DriveUserProfile {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
  permissionId?: string;
}

export interface DriveStorageQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

export interface DriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
}

export interface DriveAbout {
  user?: DriveUserProfile;
  storageQuota?: DriveStorageQuota;
}

export class DriveApiClient {
  private readonly client: GoogleApiClient;

  constructor(accessToken: string, fetchImpl?: typeof fetch) {
    this.client = new GoogleApiClient({
      accessToken,
      baseUrl: "https://www.googleapis.com/drive/v3",
      errorCode: "DRIVE_API_ERROR",
      fetchImpl,
    });
  }

  async about(): Promise<DriveAbout> {
    return this.client.json<DriveAbout>("/about", {}, {
      fields: "user(displayName,emailAddress,photoLink,permissionId),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)",
    });
  }

  async listFiles(input: { query?: string; limit?: number }): Promise<DriveFile[]> {
    const payload = await this.client.json<{ files?: DriveFile[] }>("/files", {}, {
      q: input.query,
      pageSize: input.limit ?? 20,
      fields: "files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,webContentLink)",
      orderBy: "modifiedTime desc",
    });

    return payload.files ?? [];
  }

  async getFile(id: string): Promise<DriveFile> {
    return this.client.json<DriveFile>(`/files/${encodeURIComponent(id)}`, {}, {
      fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,webContentLink",
    });
  }

  async createFolder(input: { name: string; parentId?: string }): Promise<DriveFile> {
    return this.client.json<DriveFile>("/files", {
      method: "POST",
      body: {
        name: input.name,
        mimeType: "application/vnd.google-apps.folder",
        ...(input.parentId ? { parents: [input.parentId] } : {}),
      },
    }, {
      fields: "id,name,mimeType,webViewLink,parents",
    });
  }

  async uploadFile(input: {
    filePath: string;
    name?: string;
    parentId?: string;
    mimeType?: string;
  }): Promise<DriveFile> {
    const buffer = await readFile(input.filePath);
    const metadata = {
      name: input.name?.trim() || basename(input.filePath),
      ...(input.parentId ? { parents: [input.parentId] } : {}),
    };
    const boundary = `autocli-drive-${Date.now()}`;
    const mimeType = input.mimeType?.trim() || guessMimeType(input.filePath);
    const prefix = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      "utf8",
    );
    const suffix = Buffer.from(`\r\n--${boundary}--`, "utf8");
    const body = Buffer.concat([prefix, buffer, suffix]);

    return this.client.json<DriveFile>("https://www.googleapis.com/upload/drive/v3/files", {
      method: "POST",
      headers: {
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }, {
      uploadType: "multipart",
      fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,webContentLink",
    });
  }

  async downloadFile(input: { id: string; outputPath: string }): Promise<{ bytes: number; file: DriveFile }> {
    const [file, buffer] = await Promise.all([
      this.getFile(input.id),
      this.client.buffer(`/files/${encodeURIComponent(input.id)}`, {}, { alt: "media" }),
    ]);
    await mkdir(dirname(input.outputPath), { recursive: true });
    await writeFile(input.outputPath, buffer);

    return {
      bytes: buffer.byteLength,
      file,
    };
  }

  async deleteFile(id: string): Promise<void> {
    await this.client.request(`/files/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        accept: "*/*",
      },
    });
  }
}

function guessMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  switch (extension) {
    case ".txt":
      return "text/plain";
    case ".json":
      return "application/json";
    case ".csv":
      return "text/csv";
    case ".md":
      return "text/markdown";
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}
