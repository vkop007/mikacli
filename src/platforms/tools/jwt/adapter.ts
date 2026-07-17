import crypto from "crypto";
import fs from "fs";
import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

export type JwtDecodeInput = {
  token: string;
};

export type JwtVerifyInput = {
  token: string;
  secret?: string;
  keyFile?: string;
};

export type JwtSignInput = {
  payload: Record<string, unknown>;
  secretOrKey?: string;
  keyFile?: string;
  algorithm?: string;
  expiresIn?: string | number;
  headerOverrides?: Record<string, unknown>;
};

export type JwtAuditInput = {
  token: string;
};

export class JwtAdapter {
  readonly platform: Platform = "jwt" as Platform;
  readonly displayName = "JWT Analyzer";

  async decode(input: JwtDecodeInput): Promise<AdapterActionResult> {
    const parts = input.token.trim().split(".");
    if (parts.length !== 3) {
      throw new MikaCliError("JWT_INVALID_FORMAT", "JWT must contain three parts separated by dots.");
    }

    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    if (!headerPart || !payloadPart) {
      throw new MikaCliError("JWT_INVALID_FORMAT", "JWT must contain non-empty header and payload parts.");
    }

    try {
      const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
      const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
      const signatureHex = Buffer.from(signaturePart, "base64url").toString("hex");

      const issuedAt = payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined;
      const expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined;
      const expired = payload.exp ? Date.now() / 1000 > payload.exp : false;

      return {
        ok: true,
        platform: this.platform,
        account: "public",
        action: "decode",
        message: "Decoded token metadata.",
        data: {
          header,
          payload,
          signature: signatureHex,
          timing: {
            issuedAt,
            expiresAt,
            expired,
          },
          entity: payload,
        },
      };
    } catch (error) {
      throw new MikaCliError("JWT_PARSE_FAILED", "Failed to parse JWT JSON payloads.", { cause: error });
    }
  }

  async verify(input: JwtVerifyInput): Promise<AdapterActionResult> {
    const parts = input.token.trim().split(".");
    if (parts.length !== 3) {
      throw new MikaCliError("JWT_INVALID_FORMAT", "JWT must contain three parts separated by dots.");
    }

    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    if (!headerPart || !payloadPart) {
      throw new MikaCliError("JWT_INVALID_FORMAT", "JWT must contain non-empty header and payload parts.");
    }

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
      payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    } catch (error) {
      throw new MikaCliError("JWT_PARSE_FAILED", "Failed to parse JWT JSON payloads.", { cause: error });
    }

    const alg = header.alg;
    if (!alg) {
      throw new MikaCliError("JWT_MISSING_ALGORITHM", "JWT header is missing 'alg' claim.");
    }

    let isValid = false;
    let key: string | Buffer = "";

    if (input.keyFile) {
      try {
        key = fs.readFileSync(input.keyFile, "utf8");
      } catch (err) {
        throw new MikaCliError("KEY_READ_FAILED", `Failed to read key file: ${input.keyFile}`, { cause: err });
      }
    } else if (input.secret) {
      key = input.secret;
    }

    const dataToVerify = `${headerPart}.${payloadPart}`;

    if (alg.startsWith("HS")) {
      if (!key) {
        throw new MikaCliError("MISSING_SECRET", "HMAC verification requires a secret (--secret).");
      }
      const shaAlg = alg === "HS384" ? "sha384" : alg === "HS512" ? "sha512" : "sha256";
      const computedSig = crypto.createHmac(shaAlg, key).update(dataToVerify).digest("base64url");
      
      const computedBuf = Buffer.from(computedSig, "utf8");
      const sigBuf = Buffer.from(signaturePart, "utf8");
      if (computedBuf.length === sigBuf.length) {
        isValid = crypto.timingSafeEqual(computedBuf, sigBuf);
      } else {
        isValid = false;
      }
    } else if (alg.startsWith("RS")) {
      if (!key) {
        throw new MikaCliError("MISSING_PUBLIC_KEY", "RSA verification requires a public key (--secret or --key-file).");
      }
      const shaAlg = alg === "RS384" ? "sha384" : alg === "RS512" ? "sha512" : "sha256";
      try {
        const verify = crypto.createVerify(shaAlg);
        verify.update(dataToVerify);
        isValid = verify.verify(key, signaturePart, "base64url");
      } catch (err) {
        throw new MikaCliError("SIGNATURE_VERIFICATION_FAILED", "Failed to verify signature.", { cause: err });
      }
    } else if (alg.toLowerCase() === "none") {
      isValid = false;
    } else {
      throw new MikaCliError("UNSUPPORTED_ALGORITHM", `Algorithm '${alg}' is not supported for verification.`);
    }

    const expired = payload.exp ? Date.now() / 1000 > payload.exp : false;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "verify",
      message: isValid ? "Signature verified successfully." : "Signature verification failed.",
      data: {
        isValid,
        header,
        payload,
        expired,
        timing: {
          issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined,
          expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
          expired,
        },
      },
    };
  }

  async sign(input: JwtSignInput): Promise<AdapterActionResult> {
    const alg = input.algorithm || "HS256";
    const header = {
      alg,
      typ: "JWT",
      ...input.headerOverrides,
    };

    const payload = { ...input.payload };
    const iat = (payload.iat as number) || Math.floor(Date.now() / 1000);
    payload.iat = iat;

    if (input.expiresIn) {
      const seconds = parseDuration(input.expiresIn);
      if (seconds > 0) {
        payload.exp = iat + seconds;
      }
    }

    const headerPart = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const dataToSign = `${headerPart}.${payloadPart}`;

    let key: string | Buffer = "";
    if (input.keyFile) {
      try {
        key = fs.readFileSync(input.keyFile, "utf8");
      } catch (err) {
        throw new MikaCliError("KEY_READ_FAILED", `Failed to read key file: ${input.keyFile}`, { cause: err });
      }
    } else if (input.secretOrKey) {
      key = input.secretOrKey;
    }

    if (!key) {
      throw new MikaCliError("MISSING_KEY", "Signing requires a secret or private key (--secret or --key-file).");
    }

    let signature = "";

    if (alg.startsWith("HS")) {
      const shaAlg = alg === "HS384" ? "sha384" : alg === "HS512" ? "sha512" : "sha256";
      signature = crypto.createHmac(shaAlg, key).update(dataToSign).digest("base64url");
    } else if (alg.startsWith("RS")) {
      const shaAlg = alg === "RS384" ? "sha384" : alg === "RS512" ? "sha512" : "sha256";
      try {
        const sign = crypto.createSign(shaAlg);
        sign.update(dataToSign);
        signature = sign.sign(key, "base64url");
      } catch (err) {
        throw new MikaCliError("SIGNING_FAILED", "Failed to sign JWT with RSA key.", { cause: err });
      }
    } else {
      throw new MikaCliError("UNSUPPORTED_ALGORITHM", `Algorithm '${alg}' is not supported for signing.`);
    }

    const token = `${dataToSign}.${signature}`;

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "sign",
      message: "JWT signed successfully.",
      data: {
        token,
        header,
        payload,
      },
    };
  }

  async audit(input: JwtAuditInput): Promise<AdapterActionResult> {
    const parts = input.token.trim().split(".");
    if (parts.length !== 3) {
      throw new MikaCliError("JWT_INVALID_FORMAT", "JWT must contain three parts separated by dots.");
    }

    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    if (!headerPart || !payloadPart) {
      throw new MikaCliError("JWT_INVALID_FORMAT", "JWT must contain non-empty header and payload parts.");
    }

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
      payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    } catch (error) {
      throw new MikaCliError("JWT_PARSE_FAILED", "Failed to parse JWT JSON payloads.", { cause: error });
    }

    const issues: Array<{ severity: "HIGH" | "MEDIUM" | "LOW"; message: string; detail?: string }> = [];

    const alg = header.alg;
    if (!alg) {
      issues.push({
        severity: "HIGH",
        message: "Missing 'alg' parameter in header.",
        detail: "The token header must declare the signing algorithm.",
      });
    } else if (alg.toLowerCase() === "none") {
      issues.push({
        severity: "HIGH",
        message: "Token uses the unsafe 'none' algorithm.",
        detail: "The 'none' algorithm skips signature verification and is a known vulnerability.",
      });
    }

    // Weak HMAC secret check
    if (alg && alg.startsWith("HS")) {
      const weakSecrets = [
        "secret", "admin", "123456", "password", "temp", "development", "jwt",
        "auth", "test", "key", "root", "12345678", "qwerty", "secretkey"
      ];
      const shaAlg = alg === "HS384" ? "sha384" : alg === "HS512" ? "sha512" : "sha256";
      const dataToVerify = `${headerPart}.${payloadPart}`;

      for (const secret of weakSecrets) {
        const computedSig = crypto.createHmac(shaAlg, secret).update(dataToVerify).digest("base64url");
        if (computedSig === signaturePart) {
          issues.push({
            severity: "HIGH",
            message: `Weak HMAC secret detected: '${secret}'`,
            detail: "The signature was verified using a common/weak secret. Change to a cryptographically strong secret.",
          });
          break;
        }
      }
    }

    // Expiration check
    if (!payload.exp) {
      issues.push({
        severity: "MEDIUM",
        message: "Missing expiration ('exp') claim.",
        detail: "Without an expiration claim, a leaked token remains valid indefinitely.",
      });
    } else {
      const now = Date.now() / 1000;
      if (now > payload.exp) {
        issues.push({
          severity: "LOW",
          message: "Token has expired.",
          detail: `Expired at ${new Date(payload.exp * 1000).toISOString()}`,
        });
      }

      if (payload.iat && (payload.exp - payload.iat > 86400 * 30)) {
        issues.push({
          severity: "LOW",
          message: "Overly long expiration window.",
          detail: `Token lifetime is ${Math.round((payload.exp - payload.iat) / 86400)} days. Shorter lifetimes are recommended.`,
        });
      }
    }

    // Sensitive data scanning
    const sensitiveKeysRegex = /pass|pwd|key|secret|token|cred/i;
    const scanObject = (obj: any, path = "") => {
      if (!obj || typeof obj !== "object") return;
      for (const k of Object.keys(obj)) {
        const currentPath = path ? `${path}.${k}` : k;
        if (sensitiveKeysRegex.test(k)) {
          issues.push({
            severity: "MEDIUM",
            message: `Potential sensitive field exposure: '${currentPath}'`,
            detail: "Do not store cleartext passwords, secret keys, or authentication tokens in public JWT payloads.",
          });
        }
        if (typeof obj[k] === "object") {
          scanObject(obj[k], currentPath);
        }
      }
    };
    scanObject(payload);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "audit",
      message: issues.length === 0 ? "No security issues found." : `Found ${issues.length} potential security issues.`,
      data: {
        issues,
        header,
        payload,
      },
    };
  }
}

function parseDuration(val: string | number): number {
  if (typeof val === "number") return val;
  const match = val.trim().match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const num = parseInt(match[1]!, 10);
  const unit = match[2];
  switch (unit) {
    case "s": return num;
    case "m": return num * 60;
    case "h": return num * 3600;
    case "d": return num * 86400;
    default: return 0;
  }
}

export const jwtAdapter = new JwtAdapter();
