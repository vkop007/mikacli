import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  appendUploadFileField,
  buildMultipartRelatedUpload,
  createUploadFile,
  detectMimeTypeFromPath,
  detectUploadAssetKind,
  readUploadAsset,
} from "../upload-pipeline.js";

describe("upload pipeline", () => {
  test("reads upload assets with normalized metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mikacli-upload-asset-"));
    const filePath = join(dir, "photo.png");

    try {
      await Bun.write(filePath, "png-bytes");
      const asset = await readUploadAsset(filePath);

      expect(asset.filename).toBe("photo.png");
      expect(asset.extension).toBe(".png");
      expect(asset.mimeType).toBe("image/png");
      expect(asset.kind).toBe("image");
      expect(asset.size).toBe(9);
      expect(asset.sizeBytes).toBe(9);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("builds multipart related bodies for api uploads", () => {
    const upload = buildMultipartRelatedUpload({
      metadata: {
        name: "report.pdf",
        parents: ["folder-1"],
      },
      asset: {
        bytes: Buffer.from("file-body", "utf8"),
        mimeType: "application/pdf",
      },
      boundaryPrefix: "drive-test",
    });

    expect(upload.contentType).toContain("multipart/related; boundary=drive-test-");
    expect(upload.body.toString("utf8")).toContain('"name":"report.pdf"');
    expect(upload.body.toString("utf8")).toContain("Content-Type: application/pdf");
    expect(upload.body.toString("utf8")).toContain("file-body");
  });

  test("creates reusable file and form-data helpers", () => {
    const asset = {
      filename: "image.jpg",
      mimeType: "image/jpeg",
      bytes: Buffer.from([1, 2, 3]),
    };

    const file = createUploadFile(asset);
    expect(file.name).toBe("image.jpg");
    expect(file.type).toBe("image/jpeg");

    const form = new FormData();
    appendUploadFileField(form, "media", asset);

    const appended = form.get("media");
    expect(appended).toBeInstanceOf(File);
    expect((appended as File).name).toBe("image.jpg");
  });

  test("detects kinds and mime types across common upload inputs", () => {
    expect(detectUploadAssetKind("image/png")).toBe("image");
    expect(detectUploadAssetKind("video/mp4")).toBe("video");
    expect(detectUploadAssetKind("audio/mpeg")).toBe("audio");
    expect(detectMimeTypeFromPath("clip.mp4")).toBe("video/mp4");
    expect(detectMimeTypeFromPath("notes.txt")).toBe("text/plain");
  });
});
