import tls from "node:tls";

import { MikaCliError } from "../../../errors.js";
import { normalizePublicHttpUrl } from "../shared/url.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type SslInput = {
  target: string;
  timeoutMs?: number;
};

export class SslAdapter {
  readonly platform: Platform = "ssl" as Platform;
  readonly displayName = "SSL";

  async inspect(input: SslInput): Promise<AdapterActionResult> {
    const targetUrl = normalizePublicHttpUrl(input.target);
    const url = new URL(targetUrl);
    const host = url.hostname;
    const port = url.port ? Number.parseInt(url.port, 10) : 443;
    const timeoutMs = clampNumber(input.timeoutMs ?? 15000, 1000, 60000);
    const result = await inspectTls(host, port, timeoutMs);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "ssl",
      message: `Loaded TLS certificate details for ${host}.`,
      url: `https://${host}${port === 443 ? "" : `:${port}`}/`,
      data: {
        host,
        port,
        protocol: result.protocol,
        cipher: result.cipher,
        authorized: result.authorized,
        authorizationError: result.authorizationError,
        subject: result.subject,
        issuer: result.issuer,
        validFrom: result.validFrom,
        validTo: result.validTo,
        daysRemaining: result.daysRemaining,
        altNames: result.altNames,
        serialNumber: result.serialNumber,
        fingerprint256: result.fingerprint256,
      },
    };
  }
}

export const sslAdapter = new SslAdapter();

async function inspectTls(host: string, port: number, timeoutMs: number): Promise<{
  protocol: string | null;
  cipher: string | null;
  authorized: boolean;
  authorizationError: string | null;
  subject: Record<string, unknown>;
  issuer: Record<string, unknown>;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  altNames: string[];
  serialNumber: string | null;
  fingerprint256: string | null;
}> {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = tls.connect({
      host,
      port,
      servername: host,
      rejectUnauthorized: false,
    });

    const timer = setTimeout(() => {
      socket.destroy();
      rejectPromise(
        new MikaCliError("SSL_REQUEST_FAILED", `Timed out while opening a TLS connection to ${host}:${port}.`, {
          details: {
            host,
            port,
            timeoutMs,
          },
        }),
      );
    }, timeoutMs);

    socket.on("error", (error: Error) => {
      clearTimeout(timer);
      rejectPromise(
        new MikaCliError("SSL_REQUEST_FAILED", `Unable to inspect TLS for ${host}:${port}.`, {
          cause: error,
          details: {
            host,
            port,
          },
        }),
      );
    });

    socket.on("secureConnect", () => {
      clearTimeout(timer);
      const certificate = socket.getPeerCertificate();
      const validTo = typeof certificate.valid_to === "string" ? certificate.valid_to : null;
      const validFrom = typeof certificate.valid_from === "string" ? certificate.valid_from : null;
      const daysRemaining = computeDaysRemaining(validTo);
      const altNames = typeof certificate.subjectaltname === "string"
        ? certificate.subjectaltname
            .split(",")
            .map((value: string) => value.trim())
            .filter((value: string) => value.length > 0)
        : [];

      resolvePromise({
        protocol: socket.getProtocol() ?? null,
        cipher: socket.getCipher()?.name ?? null,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ?? null,
        subject: isRecord(certificate.subject) ? certificate.subject : {},
        issuer: isRecord(certificate.issuer) ? certificate.issuer : {},
        validFrom,
        validTo,
        daysRemaining,
        altNames,
        serialNumber: typeof certificate.serialNumber === "string" ? certificate.serialNumber : null,
        fingerprint256: typeof certificate.fingerprint256 === "string" ? certificate.fingerprint256 : null,
      });
      socket.end();
    });
  });
}

function computeDaysRemaining(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  const diffMs = expiresAt.getTime() - Date.now();
  return Math.round(diffMs / 86_400_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
