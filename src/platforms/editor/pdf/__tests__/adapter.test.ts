import { describe, expect, test } from "bun:test";

import {
  buildDecryptArgs,
  buildEncryptArgs,
  buildOptimizeArgs,
  buildRotateArgs,
  normalizeRotationAngle,
  parsePageSpec,
} from "../adapter.js";

describe("pdf adapter helpers", () => {
  test("parses page specs into ranges", () => {
    expect(parsePageSpec("1,3-5,7")).toEqual([
      { start: 1, end: 1 },
      { start: 3, end: 5 },
      { start: 7, end: 7 },
    ]);
  });

  test("rejects invalid page specs", () => {
    expect(() => parsePageSpec("0")).toThrow();
    expect(() => parsePageSpec("a-b")).toThrow();
    expect(() => parsePageSpec("5-2")).toThrow();
  });

  test("normalizes rotation angles", () => {
    expect(normalizeRotationAngle(90)).toBe("+90");
    expect(normalizeRotationAngle(270)).toBe("+270");
    expect(normalizeRotationAngle(360)).toBe("0");
    expect(normalizeRotationAngle(-90)).toBe("+270");
  });

  test("rejects invalid rotation angles", () => {
    expect(() => normalizeRotationAngle(45)).toThrow();
  });

  test("builds rotate arguments", () => {
    expect(
      buildRotateArgs({
        inputPath: "/tmp/input.pdf",
        outputPath: "/tmp/output.pdf",
        angle: "+90",
        pageSpec: "1-3,5",
      }),
    ).toEqual(["--rotate=+90:1-3,5", "/tmp/input.pdf", "/tmp/output.pdf"]);
  });

  test("builds encrypt arguments", () => {
    expect(
      buildEncryptArgs({
        inputPath: "/tmp/input.pdf",
        outputPath: "/tmp/output.pdf",
        userPassword: "user",
        ownerPassword: "owner",
        bits: 256,
      }),
    ).toEqual([
      "--encrypt",
      "user",
      "owner",
      "256",
      "--",
      "/tmp/input.pdf",
      "/tmp/output.pdf",
    ]);
  });

  test("builds decrypt arguments", () => {
    expect(
      buildDecryptArgs({
        inputPath: "/tmp/input.pdf",
        outputPath: "/tmp/output.pdf",
        password: "secret",
      }),
    ).toEqual(["--password=secret", "--decrypt", "/tmp/input.pdf", "/tmp/output.pdf"]);
  });

  test("builds decrypt arguments without a password", () => {
    expect(
      buildDecryptArgs({
        inputPath: "/tmp/input.pdf",
        outputPath: "/tmp/output.pdf",
      }),
    ).toEqual(["--decrypt", "/tmp/input.pdf", "/tmp/output.pdf"]);
  });

  test("builds optimize arguments", () => {
    expect(
      buildOptimizeArgs({
        inputPath: "/tmp/input.pdf",
        outputPath: "/tmp/output.pdf",
      }),
    ).toEqual([
      "--linearize",
      "--object-streams=generate",
      "--stream-data=compress",
      "--recompress-flate",
      "--compression-level=9",
      "/tmp/input.pdf",
      "/tmp/output.pdf",
    ]);
  });

  test("builds rotate arguments without a page range", () => {
    expect(
      buildRotateArgs({
        inputPath: "/tmp/input.pdf",
        outputPath: "/tmp/output.pdf",
        angle: "+90",
      }),
    ).toEqual(["--rotate=+90", "/tmp/input.pdf", "/tmp/output.pdf"]);
  });
});
