import { describe, expect, test } from "bun:test";

import { detectArchiveFormat } from "../adapter.js";

describe("archive editor", () => {
  test("detects archive formats from file names", () => {
    expect(detectArchiveFormat("bundle.zip")).toBe("zip");
    expect(detectArchiveFormat("bundle.tar.gz")).toBe("tar.gz");
    expect(detectArchiveFormat("bundle.tgz")).toBe("tgz");
    expect(detectArchiveFormat("bundle.7z")).toBe("7z");
  });

  test("rejects unknown archive formats", () => {
    expect(() => detectArchiveFormat("bundle.bin")).toThrow();
  });
});
