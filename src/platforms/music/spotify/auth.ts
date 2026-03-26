import { createHmac } from "node:crypto";

const SPOTIFY_TOTP_PERIOD_SECONDS = 30;
const SPOTIFY_TOTP_DIGITS = 6;
const SPOTIFY_SECRET_XOR_BASE = 33;
const SPOTIFY_SECRET_XOR_OFFSET = 9;

export interface SpotifyTokenSecretCandidate {
  readonly source: string;
  readonly version: string;
}

export interface SpotifyTokenQueryOptions {
  readonly reason: string;
  readonly productType: string;
  readonly serverTimeSeconds?: number | null;
  readonly timestampMs?: number;
}

const SPOTIFY_TOKEN_SECRET_CANDIDATES: readonly SpotifyTokenSecretCandidate[] = [
  { source: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: "61" },
  { source: 'OmE{ZA.J^":0FG\\\\Uz?[@WW', version: "60" },
  { source: "{iOFn;4}<1PFYKPV?5{%u14]M>/V0hDH", version: "59" },
] as const;

export function getSpotifyTokenSecretCandidates(): readonly SpotifyTokenSecretCandidate[] {
  return SPOTIFY_TOKEN_SECRET_CANDIDATES;
}

export function generateSpotifyTotp(
  secretSource: string,
  timestampMs = Date.now(),
  digits = SPOTIFY_TOTP_DIGITS,
  periodSeconds = SPOTIFY_TOTP_PERIOD_SECONDS,
): string {
  const counter = Math.floor(timestampMs / 1000 / periodSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const secret = decodeSpotifySecret(secretSource);
  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);

  return String(code % 10 ** digits).padStart(digits, "0");
}

export function buildSpotifyTokenQueryParameters(
  options: SpotifyTokenQueryOptions,
  candidate: SpotifyTokenSecretCandidate = SPOTIFY_TOKEN_SECRET_CANDIDATES[0]!,
): URLSearchParams {
  const timestampMs = options.timestampMs ?? Date.now();
  const params = new URLSearchParams({
    reason: options.reason,
    productType: options.productType,
    totp: generateSpotifyTotp(candidate.source, timestampMs),
    totpServer:
      typeof options.serverTimeSeconds === "number" && Number.isFinite(options.serverTimeSeconds)
        ? generateSpotifyTotp(candidate.source, options.serverTimeSeconds * 1000)
        : "unavailable",
    totpVer: candidate.version,
  });

  return params;
}

function decodeSpotifySecret(source: string): Buffer {
  const obfuscated = [...source]
    .map((char, index) => char.charCodeAt(0) ^ ((index % SPOTIFY_SECRET_XOR_BASE) + SPOTIFY_SECRET_XOR_OFFSET))
    .join("");

  return Buffer.from(Buffer.from(obfuscated, "utf8").toString("hex"), "hex");
}
