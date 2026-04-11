import { DriveApiClient } from "./client.js";
import { BaseGooglePlatformAdapter } from "../shared/base.js";

import type { AdapterActionResult } from "../../../types.js";

export class DriveAdapter extends BaseGooglePlatformAdapter {
  readonly platform = "drive" as const;
  protected readonly defaultScopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive",
  ] as const;

  async me(account?: string): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(account);
    const about = await this.createClient(active.accessToken).about();

    return this.buildActionResult({
      account: active.account,
      action: "me",
      message: "Loaded Google Drive account summary.",
      sessionPath: active.path,
      user: active.user,
      data: {
        profile: {
          ...this.summarizeProfile(active.profile),
          displayName: about.user?.displayName ?? active.profile.name,
          email: about.user?.emailAddress ?? active.profile.email,
          permissionId: about.user?.permissionId,
          photoLink: about.user?.photoLink,
        },
        quota: about.storageQuota,
        scopes: active.scopes,
      },
    });
  }

  async files(input: { account?: string; query?: string; limit?: number }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const files = await this.createClient(active.accessToken).listFiles(input);

    return this.buildActionResult({
      account: active.account,
      action: "files",
      message: `Loaded ${files.length} Google Drive file${files.length === 1 ? "" : "s"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        files,
      },
    });
  }

  async file(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const file = await this.createClient(active.accessToken).getFile(input.id);

    return this.buildActionResult({
      account: active.account,
      action: "file",
      message: `Loaded Google Drive file ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: file.id,
      url: file.webViewLink,
      data: {
        file,
      },
    });
  }

  async createFolder(input: { account?: string; name: string; parentId?: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const folder = await this.createClient(active.accessToken).createFolder(input);

    return this.buildActionResult({
      account: active.account,
      action: "create-folder",
      message: `Created Google Drive folder ${input.name}.`,
      sessionPath: active.path,
      user: active.user,
      id: folder.id,
      url: folder.webViewLink,
      data: {
        file: folder,
      },
    });
  }

  async upload(input: {
    account?: string;
    filePath: string;
    name?: string;
    parentId?: string;
    mimeType?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const file = await this.createClient(active.accessToken).uploadFile(input);

    return this.buildActionResult({
      account: active.account,
      action: "upload",
      message: `Uploaded ${input.name ?? input.filePath} to Google Drive.`,
      sessionPath: active.path,
      user: active.user,
      id: file.id,
      url: file.webViewLink,
      data: {
        file,
      },
    });
  }

  async download(input: { account?: string; id: string; outputPath: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const downloaded = await this.createClient(active.accessToken).downloadFile(input);

    return this.buildActionResult({
      account: active.account,
      action: "download",
      message: `Downloaded Google Drive file ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: downloaded.file.id,
      url: downloaded.file.webViewLink,
      data: {
        file: downloaded.file,
        bytes: downloaded.bytes,
        outputPath: input.outputPath,
      },
    });
  }

  async delete(input: { account?: string; id: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    await this.createClient(active.accessToken).deleteFile(input.id);

    return this.buildActionResult({
      account: active.account,
      action: "delete",
      message: `Deleted Google Drive file ${input.id}.`,
      sessionPath: active.path,
      user: active.user,
      id: input.id,
      data: {
        file: {
          id: input.id,
          status: "deleted",
        },
      },
    });
  }

  private createClient(accessToken: string): DriveApiClient {
    return new DriveApiClient(accessToken, this.fetchImpl);
  }
}

export const driveAdapter = new DriveAdapter();
