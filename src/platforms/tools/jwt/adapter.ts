import { MikaCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

export type JwtDecodeInput = {
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

    try {
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      const signatureHex = Buffer.from(parts[2], "base64url").toString("hex");

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
}

export const jwtAdapter = new JwtAdapter();
