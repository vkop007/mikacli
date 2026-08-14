import { describe, expect, test } from "bun:test";
import crypto from "crypto";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { hashAdapter } from "../adapter.js";

describe("hash offline tool", () => {
  const text = "hello world";
  const sha256Hex = crypto.createHash("sha256").update(text).digest("hex");

  test("digests text with the default algorithm", async () => {
    const result = await hashAdapter.digest({ text });
    expect(result.ok).toBe(true);

    const data = result.data as any;
    expect(data.algorithm).toBe("sha256");
    expect(data.encoding).toBe("hex");
    expect(data.digest).toBe(sha256Hex);
    expect(data.bytes).toBe(Buffer.byteLength(text));
  });

  test("digests a file and honours the requested algorithm and encoding", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mikacli-hash-"));
    const filePath = join(dir, "sample.txt");
    writeFileSync(filePath, text, "utf8");

    const result = await hashAdapter.digest({ file: filePath, algorithm: "sha512", encoding: "base64" });
    const data = result.data as any;
    expect(data.algorithm).toBe("sha512");
    expect(data.digest).toBe(crypto.createHash("sha512").update(text).digest("base64"));
    expect(data.source).toBe(filePath);
  });

  test("rejects unsupported algorithms", async () => {
    expect(hashAdapter.digest({ text, algorithm: "not-a-hash" })).rejects.toThrow();
  });

  test("requires text or a file", async () => {
    expect(hashAdapter.digest({})).rejects.toThrow();
  });

  test("computes an HMAC that matches node crypto", async () => {
    const result = await hashAdapter.hmac({ text, secret: "top-secret", encoding: "base64url" });
    const data = result.data as any;
    expect(data.digest).toBe(crypto.createHmac("sha256", "top-secret").update(text).digest("base64url"));
  });

  test("requires a secret for HMAC", async () => {
    expect(hashAdapter.hmac({ text })).rejects.toThrow();
  });

  test("verifies matching and mismatching checksums", async () => {
    const match = await hashAdapter.verify({ expected: sha256Hex, text });
    expect((match.data as any).matches).toBe(true);
    expect((match.data as any).algorithm).toBe("sha256");

    const uppercased = await hashAdapter.verify({ expected: sha256Hex.toUpperCase(), text });
    expect((uppercased.data as any).matches).toBe(true);

    const mismatch = await hashAdapter.verify({ expected: sha256Hex, text: "tampered" });
    expect((mismatch.data as any).matches).toBe(false);
  });

  test("infers the algorithm from the checksum length", async () => {
    const md5 = crypto.createHash("md5").update(text).digest("hex");
    const result = await hashAdapter.verify({ expected: md5, text });
    const data = result.data as any;
    expect(data.algorithm).toBe("md5");
    expect(data.matches).toBe(true);
  });

  test("round-trips values between encodings", async () => {
    const encoded = await hashAdapter.encode({ value: text, to: "base64url" });
    const encodedValue = (encoded.data as any).output as string;
    expect(encodedValue).toBe(Buffer.from(text, "utf8").toString("base64url"));

    const decoded = await hashAdapter.encode({ value: encodedValue, from: "base64url", to: "utf8" });
    expect((decoded.data as any).output).toBe(text);

    const urlEncoded = await hashAdapter.encode({ value: "a b&c", to: "url" });
    expect((urlEncoded.data as any).output).toBe("a%20b%26c");
  });

  test("rejects unsupported encodings", async () => {
    expect(hashAdapter.encode({ value: text, to: "rot13" as never })).rejects.toThrow();
  });

  test("generates v4 and v7 UUIDs", async () => {
    const v4 = await hashAdapter.uuid({ count: 3 });
    const v4Items = (v4.data as any).items as string[];
    expect(v4Items).toHaveLength(3);
    expect(new Set(v4Items).size).toBe(3);
    for (const value of v4Items) {
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }

    const v7 = await hashAdapter.uuid({ version: 7 });
    const v7Value = ((v7.data as any).items as string[])[0]!;
    expect(v7Value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const timestamp = Number.parseInt(v7Value.replace(/-/g, "").slice(0, 12), 16);
    expect(Math.abs(Date.now() - timestamp)).toBeLessThan(5000);
  });

  test("rejects unsupported UUID versions", async () => {
    expect(hashAdapter.uuid({ version: 1 })).rejects.toThrow();
  });

  test("generates random secrets of the requested size", async () => {
    const result = await hashAdapter.random({ bytes: 16, count: 2 });
    const items = (result.data as any).items as string[];
    expect(items).toHaveLength(2);
    for (const value of items) {
      expect(value).toHaveLength(32);
    }
    expect(items[0]).not.toBe(items[1]);
  });

  test("rejects out-of-range byte lengths", async () => {
    expect(hashAdapter.random({ bytes: 0 })).rejects.toThrow();
    expect(hashAdapter.random({ bytes: 100000 })).rejects.toThrow();
  });

  test("lists supported algorithms", async () => {
    const result = await hashAdapter.algorithms();
    const items = (result.data as any).items as string[];
    expect(items).toContain("sha256");
    expect(items.length).toBeGreaterThan(0);
  });
});
