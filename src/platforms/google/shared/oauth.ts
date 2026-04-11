import { AutoCliError } from "../../../errors.js";

export const GOOGLE_OPENID_SCOPES = ["openid", "email", "profile"] as const;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const USER_AGENT = "AutoCLI/0.1 (+https://github.com/vkop007/autocli)";

export interface GoogleAuthUrlInput {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state?: string;
  loginHint?: string;
}

export interface GoogleTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
  tokenType?: string;
}

export interface GoogleUserProfile {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  hostedDomain?: string;
}

export function buildGoogleAuthUrl(input: GoogleAuthUrlInput): string {
  const clientId = input.clientId.trim();
  const redirectUri = input.redirectUri.trim();
  if (!clientId) {
    throw new AutoCliError("GOOGLE_CLIENT_ID_REQUIRED", "Google OAuth requires --client-id.");
  }
  if (!redirectUri) {
    throw new AutoCliError("GOOGLE_REDIRECT_URI_REQUIRED", "Google OAuth requires --redirect-uri.");
  }

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", uniqueStrings(input.scopes).join(" "));

  if (input.state?.trim()) {
    url.searchParams.set("state", input.state.trim());
  }

  if (input.loginHint?.trim()) {
    url.searchParams.set("login_hint", input.loginHint.trim());
  }

  return url.toString();
}

export class GoogleOAuthClient {
  constructor(
    private readonly options: {
      clientId: string;
      clientSecret?: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async exchangeCode(input: { code: string; redirectUri: string }): Promise<GoogleTokenSet> {
    const code = input.code.trim();
    const redirectUri = input.redirectUri.trim();
    if (!code) {
      throw new AutoCliError("GOOGLE_AUTH_CODE_REQUIRED", "Google OAuth login requires --code.");
    }
    if (!redirectUri) {
      throw new AutoCliError("GOOGLE_REDIRECT_URI_REQUIRED", "Google OAuth login with --code also requires --redirect-uri.");
    }

    return this.requestToken(new URLSearchParams({
      client_id: this.requireClientId(),
      client_secret: this.requireClientSecret(),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }));
  }

  async refreshAccessToken(input: { refreshToken: string }): Promise<GoogleTokenSet> {
    const refreshToken = input.refreshToken.trim();
    if (!refreshToken) {
      throw new AutoCliError("GOOGLE_REFRESH_TOKEN_REQUIRED", "Google OAuth refresh requires a saved refresh token.");
    }

    return this.requestToken(new URLSearchParams({
      client_id: this.requireClientId(),
      client_secret: this.requireClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }));
  }

  async getUserProfile(accessToken: string): Promise<GoogleUserProfile> {
    const response = await this.fetchImpl()(GOOGLE_USERINFO_URL, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        "user-agent": USER_AGENT,
      },
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new AutoCliError("GOOGLE_USERINFO_FAILED", extractGoogleErrorMessage(payload, response.status), {
        details: {
          status: response.status,
        },
      });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new AutoCliError("GOOGLE_USERINFO_INVALID", "Google userinfo returned an unreadable profile.");
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.sub !== "string") {
      throw new AutoCliError("GOOGLE_USERINFO_INVALID", "Google userinfo returned an unreadable profile.");
    }

    return {
      sub: record.sub as string,
      ...(typeof record.email === "string" ? { email: record.email } : {}),
      ...(typeof record.email_verified === "boolean" ? { emailVerified: record.email_verified } : {}),
      ...(typeof record.name === "string" ? { name: record.name } : {}),
      ...(typeof record.given_name === "string" ? { givenName: record.given_name } : {}),
      ...(typeof record.family_name === "string" ? { familyName: record.family_name } : {}),
      ...(typeof record.picture === "string" ? { picture: record.picture } : {}),
      ...(typeof record.hd === "string" ? { hostedDomain: record.hd } : {}),
    };
  }

  private async requestToken(params: URLSearchParams): Promise<GoogleTokenSet> {
    const response = await this.fetchImpl()(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: params,
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw new AutoCliError("GOOGLE_TOKEN_REQUEST_FAILED", extractGoogleErrorMessage(payload, response.status), {
        details: {
          status: response.status,
        },
      });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new AutoCliError("GOOGLE_TOKEN_INVALID", "Google token exchange returned an unreadable response.");
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.access_token !== "string") {
      throw new AutoCliError("GOOGLE_TOKEN_INVALID", "Google token exchange returned an unreadable response.");
    }
    const expiresIn = typeof record.expires_in === "number" && Number.isFinite(record.expires_in) ? record.expires_in : undefined;
    const scopeText = typeof record.scope === "string" ? record.scope : "";

    return {
      accessToken: record.access_token as string,
      ...(typeof record.refresh_token === "string" ? { refreshToken: record.refresh_token } : {}),
      ...(expiresIn ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() } : {}),
      scopes: scopeText.length > 0 ? uniqueStrings(scopeText.split(/\s+/u).filter(Boolean)) : [],
      ...(typeof record.token_type === "string" ? { tokenType: record.token_type } : {}),
    };
  }

  private requireClientId(): string {
    const clientId = this.options.clientId?.trim();
    if (!clientId) {
      throw new AutoCliError("GOOGLE_CLIENT_ID_REQUIRED", "Google OAuth requires --client-id.");
    }

    return clientId;
  }

  private requireClientSecret(): string {
    const clientSecret = this.options.clientSecret?.trim();
    if (!clientSecret) {
      throw new AutoCliError("GOOGLE_CLIENT_SECRET_REQUIRED", "Google OAuth requires --client-secret.");
    }

    return clientSecret;
  }

  private fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? fetch;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AutoCliError("GOOGLE_JSON_INVALID", "Google returned a non-JSON response.", {
      cause: error,
      details: {
        status: response.status,
        preview: text.slice(0, 400),
      },
    });
  }
}

function extractGoogleErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (typeof record.error_description === "string" && record.error_description.trim().length > 0) {
      return record.error_description.trim();
    }

    if (typeof record.error === "string" && record.error.trim().length > 0) {
      return record.error.trim();
    }

    const nestedError = record.error;
    if (nestedError && typeof nestedError === "object" && !Array.isArray(nestedError)) {
      const nestedRecord = nestedError as Record<string, unknown>;
      if (typeof nestedRecord.message === "string" && nestedRecord.message.trim().length > 0) {
        return nestedRecord.message.trim();
      }
    }
  }

  return `Google OAuth request failed with status ${status}.`;
}

function uniqueStrings(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
