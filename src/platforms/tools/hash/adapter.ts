import crypto from "crypto";
import fs from "fs";
import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

export type DigestEncoding = "hex" | "base64" | "base64url";
export type TextEncoding = "utf8" | "base64" | "base64url" | "hex" | "url" | "ascii" | "latin1";

export type HashDigestInput = {
  text?: string;
  file?: string;
  algorithm?: string;
  encoding?: DigestEncoding;
};

export type HashHmacInput = {
  text?: string;
  file?: string;
  secret?: string;
  keyFile?: string;
  algorithm?: string;
  encoding?: DigestEncoding;
};

export type HashVerifyInput = {
  expected: string;
  text?: string;
  file?: string;
  algorithm?: string;
};

export type HashEncodeInput = {
  value: string;
  from?: TextEncoding;
  to?: TextEncoding;
};

export type HashUuidInput = {
  count?: number;
  version?: number;
};

export type HashRandomInput = {
  bytes?: number;
  count?: number;
  encoding?: DigestEncoding;
};

const DEFAULT_ALGORITHM = "sha256";
const DEFAULT_DIGEST_ENCODING: DigestEncoding = "hex";
const DIGEST_ENCODINGS: readonly DigestEncoding[] = ["hex", "base64", "base64url"];
const TEXT_ENCODINGS: readonly TextEncoding[] = ["utf8", "base64", "base64url", "hex", "url", "ascii", "latin1"];
const MAX_RANDOM_BYTES = 4096;
const MAX_ITEM_COUNT = 1000;

export class HashAdapter {
  readonly platform: Platform = "hash" as Platform;
  readonly displayName = "Hash & Encoding";

  async digest(input: HashDigestInput): Promise<AdapterActionResult> {
    const algorithm = resolveAlgorithm(input.algorithm);
    const encoding = resolveDigestEncoding(input.encoding);
    const source = readSource(input.text, input.file);
    const digest = crypto.createHash(algorithm).update(source.bytes).digest(encoding);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "digest",
      message: `Computed ${algorithm} digest.`,
      data: {
        algorithm,
        encoding,
        digest,
        bytes: source.bytes.length,
        source: source.label,
        entity: { algorithm, encoding, digest },
      },
    };
  }

  async hmac(input: HashHmacInput): Promise<AdapterActionResult> {
    const algorithm = resolveAlgorithm(input.algorithm);
    const encoding = resolveDigestEncoding(input.encoding);
    const source = readSource(input.text, input.file);
    const key = resolveKey(input.secret, input.keyFile);
    const digest = crypto.createHmac(algorithm, key).update(source.bytes).digest(encoding);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "hmac",
      message: `Computed ${algorithm} HMAC.`,
      data: {
        algorithm,
        encoding,
        digest,
        bytes: source.bytes.length,
        source: source.label,
        entity: { algorithm, encoding, digest },
      },
    };
  }

  async verify(input: HashVerifyInput): Promise<AdapterActionResult> {
    const expected = input.expected.trim();
    if (!expected) {
      throw new MikaCliError("HASH_MISSING_EXPECTED", "Provide the expected checksum to compare against.");
    }

    const algorithm = resolveAlgorithm(input.algorithm ?? guessAlgorithmFromDigest(expected));
    const source = readSource(input.text, input.file);
    const encoding = guessDigestEncoding(expected);
    const actual = crypto.createHash(algorithm).update(source.bytes).digest(encoding);
    const matches = timingSafeCompare(normalizeDigest(actual, encoding), normalizeDigest(expected, encoding));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "verify",
      message: matches ? "Checksum matches." : "Checksum does not match.",
      data: {
        matches,
        algorithm,
        encoding,
        expected,
        actual,
        bytes: source.bytes.length,
        source: source.label,
        entity: { matches, algorithm, expected, actual },
      },
    };
  }

  async encode(input: HashEncodeInput): Promise<AdapterActionResult> {
    const from = resolveTextEncoding(input.from, "utf8", "--from");
    const to = resolveTextEncoding(input.to, "base64", "--to");
    const bytes = decodeValue(input.value, from);
    const output = encodeValue(bytes, to);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "encode",
      message: `Converted ${from} to ${to}.`,
      data: {
        from,
        to,
        input: input.value,
        output,
        bytes: bytes.length,
        entity: { from, to, output },
      },
    };
  }

  async uuid(input: HashUuidInput): Promise<AdapterActionResult> {
    const count = resolveCount(input.count);
    const version = input.version ?? 4;
    if (version !== 4 && version !== 7) {
      throw new MikaCliError("HASH_UNSUPPORTED_UUID_VERSION", `UUID version '${version}' is not supported. Use 4 or 7.`);
    }

    const items = Array.from({ length: count }, () => (version === 7 ? generateUuidV7() : crypto.randomUUID()));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "uuid",
      message: `Generated ${count} UUID${count === 1 ? "" : "s"}.`,
      data: {
        version,
        count,
        items,
        entity: { version, value: items[0] },
      },
    };
  }

  async random(input: HashRandomInput): Promise<AdapterActionResult> {
    const encoding = resolveDigestEncoding(input.encoding);
    const count = resolveCount(input.count);
    const bytes = resolveByteLength(input.bytes);
    const items = Array.from({ length: count }, () => crypto.randomBytes(bytes).toString(encoding));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "random",
      message: `Generated ${count} random value${count === 1 ? "" : "s"} of ${bytes} bytes.`,
      data: {
        bytes,
        encoding,
        count,
        items,
        entity: { bytes, encoding, value: items[0] },
      },
    };
  }

  async algorithms(): Promise<AdapterActionResult> {
    const items = crypto.getHashes().slice().sort();

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "algorithms",
      message: `Found ${items.length} supported hash algorithms.`,
      data: {
        count: items.length,
        items,
        guidance: `Pass any of these with --alg (default: ${DEFAULT_ALGORITHM}).`,
      },
    };
  }
}

type HashSource = {
  bytes: Buffer;
  label: string;
};

function readSource(text: string | undefined, file: string | undefined): HashSource {
  if (file) {
    try {
      return { bytes: fs.readFileSync(file), label: file };
    } catch (error) {
      throw new MikaCliError("HASH_FILE_READ_FAILED", `Failed to read file: ${file}`, { cause: error });
    }
  }

  if (text === undefined || text === "") {
    throw new MikaCliError("HASH_MISSING_INPUT", "Provide text to hash or a file with --file.");
  }

  return { bytes: Buffer.from(text, "utf8"), label: "text" };
}

function resolveKey(secret: string | undefined, keyFile: string | undefined): Buffer {
  if (keyFile) {
    try {
      return fs.readFileSync(keyFile);
    } catch (error) {
      throw new MikaCliError("HASH_KEY_READ_FAILED", `Failed to read key file: ${keyFile}`, { cause: error });
    }
  }

  if (!secret) {
    throw new MikaCliError("HASH_MISSING_SECRET", "HMAC requires a secret (--secret) or key file (--key-file).");
  }

  return Buffer.from(secret, "utf8");
}

function resolveAlgorithm(algorithm: string | undefined): string {
  const normalized = (algorithm ?? DEFAULT_ALGORITHM).trim().toLowerCase();
  const supported = crypto.getHashes();
  if (!supported.includes(normalized)) {
    throw new MikaCliError(
      "HASH_UNSUPPORTED_ALGORITHM",
      `Algorithm '${normalized}' is not supported. Run 'mikacli tools hash algorithms' to list the supported ones.`,
    );
  }

  return normalized;
}

function resolveDigestEncoding(encoding: string | undefined): DigestEncoding {
  const normalized = (encoding ?? DEFAULT_DIGEST_ENCODING).trim().toLowerCase();
  if (!DIGEST_ENCODINGS.includes(normalized as DigestEncoding)) {
    throw new MikaCliError(
      "HASH_UNSUPPORTED_ENCODING",
      `Encoding '${normalized}' is not supported. Use one of: ${DIGEST_ENCODINGS.join(", ")}.`,
    );
  }

  return normalized as DigestEncoding;
}

function resolveTextEncoding(encoding: string | undefined, fallback: TextEncoding, flag: string): TextEncoding {
  const normalized = (encoding ?? fallback).trim().toLowerCase();
  if (!TEXT_ENCODINGS.includes(normalized as TextEncoding)) {
    throw new MikaCliError(
      "HASH_UNSUPPORTED_ENCODING",
      `Encoding '${normalized}' is not supported for ${flag}. Use one of: ${TEXT_ENCODINGS.join(", ")}.`,
    );
  }

  return normalized as TextEncoding;
}

function resolveCount(count: number | undefined): number {
  if (count === undefined) {
    return 1;
  }

  if (!Number.isInteger(count) || count < 1 || count > MAX_ITEM_COUNT) {
    throw new MikaCliError("HASH_INVALID_COUNT", `Count must be an integer between 1 and ${MAX_ITEM_COUNT}.`);
  }

  return count;
}

function resolveByteLength(bytes: number | undefined): number {
  if (bytes === undefined) {
    return 32;
  }

  if (!Number.isInteger(bytes) || bytes < 1 || bytes > MAX_RANDOM_BYTES) {
    throw new MikaCliError("HASH_INVALID_BYTES", `Byte length must be an integer between 1 and ${MAX_RANDOM_BYTES}.`);
  }

  return bytes;
}

function decodeValue(value: string, from: TextEncoding): Buffer {
  if (from === "url") {
    return Buffer.from(decodeURIComponent(value), "utf8");
  }

  return Buffer.from(value, from);
}

function encodeValue(bytes: Buffer, to: TextEncoding): string {
  if (to === "url") {
    return encodeURIComponent(bytes.toString("utf8"));
  }

  return bytes.toString(to);
}

function guessDigestEncoding(expected: string): DigestEncoding {
  if (/^[0-9a-f]+$/i.test(expected)) {
    return "hex";
  }

  return expected.includes("-") || expected.includes("_") ? "base64url" : "base64";
}

function guessAlgorithmFromDigest(expected: string): string {
  if (!/^[0-9a-f]+$/i.test(expected)) {
    return DEFAULT_ALGORITHM;
  }

  switch (expected.length) {
    case 32:
      return "md5";
    case 40:
      return "sha1";
    case 64:
      return "sha256";
    case 96:
      return "sha384";
    case 128:
      return "sha512";
    default:
      return DEFAULT_ALGORITHM;
  }
}

function normalizeDigest(digest: string, encoding: DigestEncoding): string {
  return encoding === "hex" ? digest.trim().toLowerCase() : digest.trim();
}

function timingSafeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function generateUuidV7(): string {
  const bytes = crypto.randomBytes(16);
  const timestamp = BigInt(Date.now());

  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const hashAdapter = new HashAdapter();
