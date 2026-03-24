import { randomBytes } from "node:crypto";

import { AutoCliError, isAutoCliError } from "../errors.js";
import { getPlatformOrigin } from "../platforms.js";
import { parseLinkedInTarget } from "../utils/targets.js";
import { BasePlatformAdapter } from "./base.js";
import { CookieJar, Cookie } from "tough-cookie";

import type {
  AdapterActionResult,
  AdapterStatusResult,
  CommentInput,
  LikeInput,
  LoginInput,
  PlatformSession,
  PostMediaInput,
  SessionStatus,
  SessionUser,
  TextPostInput,
} from "../types.js";

const LINKEDIN_ORIGIN = getPlatformOrigin("linkedin");
const LINKEDIN_FEED = `${LINKEDIN_ORIGIN}/feed/`;
const LINKEDIN_ME_ENDPOINT = `${LINKEDIN_ORIGIN}/voyager/api/me`;
const LINKEDIN_GRAPHQL_ENDPOINT = `${LINKEDIN_ORIGIN}/voyager/api/graphql`;
const LINKEDIN_CREATE_POST_ENDPOINT = `${LINKEDIN_ORIGIN}/voyager/api/contentcreation/normShares`;
const LINKEDIN_REACTION_ENDPOINTS = [
  `${LINKEDIN_ORIGIN}/voyager/api/voyagerFeedReactions?action=create`,
  `${LINKEDIN_ORIGIN}/voyager/api/feed/reactions?action=create`,
] as const;
const LINKEDIN_COMMENT_SIGNAL_QUERY_ID = "inSessionRelevanceVoyagerFeedDashClientSignal.c1c9c08097afa4e02954945e9df54091";
const LINKEDIN_COMMENT_SIGNAL_ENDPOINT = `${LINKEDIN_GRAPHQL_ENDPOINT}?action=execute&queryId=${LINKEDIN_COMMENT_SIGNAL_QUERY_ID}`;
const LINKEDIN_COMMENT_ENDPOINT =
  `${LINKEDIN_ORIGIN}/voyager/api/voyagerSocialDashNormComments?decorationId=com.linkedin.voyager.dash.deco.social.NormComment-43`;
const LINKEDIN_COOKIE_ALLOWLIST = new Set([
  "JSESSIONID",
  "bcookie",
  "bscookie",
  "g_state",
  "lang",
  "li_at",
  "li_sugr",
  "li_theme",
  "li_theme_set",
  "liap",
  "lidc",
  "timezone",
]);
const LINKEDIN_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface LinkedInProbe {
  status: SessionStatus;
  user?: SessionUser;
  metadata?: Record<string, unknown>;
}

interface LinkedInLocalizedField {
  localized?: Record<string, string>;
  preferredLocale?: {
    country?: string;
    language?: string;
  };
}

interface LinkedInMeResponse {
  entityUrn?: string;
  plainId?: string;
  firstName?: LinkedInLocalizedField;
  lastName?: LinkedInLocalizedField;
  miniProfile?: {
    entityUrn?: string;
    publicIdentifier?: string;
    firstName?: string;
    lastName?: string;
  };
}

interface LinkedInEntityResponse {
  urn?: string;
  entityUrn?: string;
  data?: {
    urn?: string;
    entityUrn?: string;
    data?: {
      createContentcreationDashShares?: {
        resourceKey?: string;
        shareUrn?: string;
        entity?: string;
        "*entity"?: string;
      };
    };
  };
  value?: {
    urn?: string;
    entityUrn?: string;
  };
  included?: Array<{
    entityUrn?: string;
  }>;
}

export class LinkedInAdapter extends BasePlatformAdapter {
  readonly platform = "linkedin" as const;

  async login(input: LoginInput): Promise<AdapterActionResult> {
    const imported = await this.cookieManager.importCookies(this.platform, input);
    const probe = await this.inspectCookieJar(imported.jar);
    const account = input.account ?? "default";
    const sessionPath = await this.saveSession({
      account,
      source: imported.source,
      status: probe.status,
      metadata: probe.metadata,
      jar: imported.jar,
    });

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "LinkedIn session has expired.", {
        details: {
          platform: this.platform,
          account,
          sessionPath,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account,
      action: "login",
      message: `Saved LinkedIn session for ${account}. Live validation is deferred.`,
      sessionPath,
      data: {
        status: probe.status.state,
      },
    };
  }

  async getStatus(account?: string): Promise<AdapterStatusResult> {
    const { session, path } = await this.loadSession(account);
    const probe = await this.inspectStoredSession(session);
    await this.persistSessionState(session, probe);
    return this.buildStatusResult({
      account: session.account,
      sessionPath: path,
      status: probe.status,
      user: session.user,
    });
  }

  async postMedia(_input: PostMediaInput): Promise<AdapterActionResult> {
    throw new AutoCliError(
      "UNSUPPORTED_ACTION",
      "LinkedIn media upload is not implemented yet. Use `autocli linkedin post \"text\"` for now.",
    );
  }

  async postText(input: TextPostInput): Promise<AdapterActionResult> {
    const { session } = await this.loadSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createLinkedInClient(session);
    const payload = this.buildPostPayload(input.text);

    let result: { data: LinkedInEntityResponse; response: Response };
    try {
      result = await client.requestWithResponse<LinkedInEntityResponse>(LINKEDIN_CREATE_POST_ENDPOINT, {
        method: "POST",
        expectedStatus: [200, 201],
        headers: await this.buildLinkedInHeaders(client, {
          json: true,
          referer: LINKEDIN_FEED,
        }),
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw this.mapLinkedInWriteError(error, "Failed to create the LinkedIn post.");
    }

    const entityUrn = this.extractCreatePostUrn(result.data, result.response);
    if (!entityUrn) {
      throw new AutoCliError("LINKEDIN_RESPONSE_INVALID", "LinkedIn created the post but did not return a post URN.");
    }

    const url = entityUrn ? this.entityUrnToUrl(entityUrn) : undefined;

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "post",
      message: `LinkedIn post created for ${session.account}.`,
      id: entityUrn,
      url,
      user: probe.user,
      data: {
        text: input.text,
      },
    };
  }

  async like(input: LikeInput): Promise<AdapterActionResult> {
    const { session } = await this.loadSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createLinkedInClient(session);
    const target = parseLinkedInTarget(input.target);
    const memberUrn = typeof probe.metadata?.memberUrn === "string" ? probe.metadata.memberUrn : undefined;

    const attempts = LINKEDIN_REACTION_ENDPOINTS.flatMap((endpoint) =>
      this.buildReactionPayloads(target.entityUrns, memberUrn).map(
        (payload) => async () =>
          client.request(endpoint, {
            method: "POST",
            expectedStatus: [200, 201],
            headers: await this.buildLinkedInHeaders(client, {
              json: true,
              referer: target.url ?? LINKEDIN_FEED,
            }),
            body: JSON.stringify(payload),
          }),
      ),
    );

    await this.tryRequestChain(attempts, "Failed to like the LinkedIn post.");

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "like",
      message: `LinkedIn post liked for ${session.account}.`,
      id: target.entityUrns[0],
      user: probe.user,
    };
  }

  async comment(input: CommentInput): Promise<AdapterActionResult> {
    const { session } = await this.loadSession(input.account);
    const probe = await this.ensureActiveSession(session);
    const client = await this.createLinkedInClient(session);
    const target = parseLinkedInTarget(input.target);
    const threadUrn = this.normalizeThreadUrn(target.entityUrns[0]);
    if (!threadUrn) {
      throw new AutoCliError(
        "INVALID_TARGET",
        "LinkedIn comments require an activity, ugcPost, or feed update target.",
        { details: { target: input.target } },
      );
    }

    const commentHeaders = await this.buildLinkedInCommentHeaders(client, target.url ?? LINKEDIN_FEED);

    try {
      await client.request(LINKEDIN_COMMENT_SIGNAL_ENDPOINT, {
        method: "POST",
        expectedStatus: [200, 201],
        headers: commentHeaders,
        body: JSON.stringify({
          variables: {
            backendUpdateUrn: threadUrn,
            actionType: "submitComment",
          },
          queryId: LINKEDIN_COMMENT_SIGNAL_QUERY_ID,
          includeWebMetadata: true,
        }),
      });
    } catch (error) {
      throw this.mapLinkedInWriteError(error, "Failed to prepare the LinkedIn comment.");
    }

    let response: { data: LinkedInEntityResponse; response: Response };
    try {
      response = await client.requestWithResponse<LinkedInEntityResponse>(LINKEDIN_COMMENT_ENDPOINT, {
        method: "POST",
        expectedStatus: [200, 201],
        headers: commentHeaders,
        body: JSON.stringify({
          commentary: {
            text: input.text,
            attributesV2: [],
            $type: "com.linkedin.voyager.dash.common.text.TextViewModel",
          },
          threadUrn,
        }),
      });
    } catch (error) {
      throw this.mapLinkedInWriteError(error, "Failed to comment on the LinkedIn post.");
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "comment",
      message: `LinkedIn comment sent for ${session.account}.`,
      id: this.extractCreatePostUrn(response.data, response.response) ?? target.entityUrns[0],
      user: probe.user,
      data: {
        text: input.text,
      },
    };
  }

  private async ensureActiveSession(session: PlatformSession): Promise<LinkedInProbe> {
    const probe = await this.inspectStoredSession(session);
    await this.persistSessionState(session, probe);

    if (probe.status.state === "expired") {
      throw new AutoCliError("SESSION_EXPIRED", probe.status.message ?? "LinkedIn session has expired.", {
        details: {
          platform: this.platform,
          account: session.account,
        },
      });
    }

    return {
      status: probe.status,
      user: session.user,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
    };
  }

  private async inspectStoredSession(session: PlatformSession): Promise<LinkedInProbe> {
    const jar = await this.cookieManager.createJar(session);
    return this.inspectCookieJar(jar, session.metadata);
  }

  private async inspectCookieJar(jar: CookieJar, existingMetadata?: Record<string, unknown>): Promise<LinkedInProbe> {
    const cookies = await jar.getCookies(LINKEDIN_FEED);
    const liAt = cookies.find((cookie) => cookie.key === "li_at")?.value;
    const jsessionIdRaw = cookies.find((cookie) => cookie.key === "JSESSIONID")?.value;
    const csrfToken = this.extractCsrfToken(jsessionIdRaw);

    if (!liAt || !csrfToken) {
      return {
        status: {
          state: "expired",
          message: "Missing required LinkedIn session cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    return {
      status: {
        state: "unknown",
        message: "Saved LinkedIn session tokens are present. Live validation is disabled because LinkedIn may revoke replayed browser sessions.",
        lastValidatedAt: new Date().toISOString(),
      },
      metadata: {
        ...(existingMetadata ?? {}),
        csrfToken,
      },
    };
  }

  private async probeSession(session: PlatformSession): Promise<LinkedInProbe> {
    const client = await this.createLinkedInClient(session);
    const liAt = await client.getCookieValue("li_at", LINKEDIN_FEED);
    const jsessionIdRaw = await client.getCookieValue("JSESSIONID", LINKEDIN_FEED);
    const csrfToken = this.extractCsrfToken(jsessionIdRaw);

    if (!liAt || !csrfToken) {
      return {
        status: {
          state: "expired",
          message: "Missing required LinkedIn session cookies. Re-import cookies.txt.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: "COOKIE_MISSING",
        },
      };
    }

    try {
      const me = await client.request<LinkedInMeResponse>(LINKEDIN_ME_ENDPOINT, {
        expectedStatus: 200,
        headers: await this.buildLinkedInHeaders(client),
      });
      const user = this.extractUser(me);

      return {
        status: {
          state: "active",
          message: user ? "Session validated." : "LinkedIn session is active, but profile metadata was limited.",
          lastValidatedAt: new Date().toISOString(),
        },
        user,
        metadata: {
          csrfToken,
          memberUrn: this.extractMemberUrn(me),
        },
      };
    } catch (error) {
      if (this.isAuthFailure(error)) {
        return {
          status: {
            state: "expired",
            message: "LinkedIn rejected the saved session. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "AUTH_FAILED",
          },
        };
      }

      return {
        status: {
          state: "unknown",
          message: "Cookies look valid but LinkedIn profile validation was unavailable.",
          lastValidatedAt: new Date().toISOString(),
        },
        metadata: {
          csrfToken,
        },
      };
    }
  }

  private async createLinkedInClient(session: PlatformSession) {
    const jar = await this.cookieManager.createJar(session);
    const filteredJar = await this.filterLinkedInCookies(jar);

    return new (await import("../utils/http-client.js")).SessionHttpClient(filteredJar, {
      accept: "application/vnd.linkedin.normalized+json+2.1",
      "accept-language": "en-US,en;q=0.9",
      origin: LINKEDIN_ORIGIN,
      referer: LINKEDIN_FEED,
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": LINKEDIN_USER_AGENT,
      "x-li-lang": "en_US",
      "x-li-track": buildLinkedInTrackHeader(),
      "x-restli-protocol-version": "2.0.0",
    });
  }

  private async buildLinkedInHeaders(
    client: Awaited<ReturnType<LinkedInAdapter["createLinkedInClient"]>>,
    options?: {
      json?: boolean;
      referer?: string;
    },
  ): Promise<Record<string, string>> {
    const csrfToken = this.extractCsrfToken(await client.getCookieValue("JSESSIONID", LINKEDIN_FEED));
    if (!csrfToken) {
      throw new AutoCliError("SESSION_EXPIRED", "LinkedIn CSRF token is missing. Re-import cookies.txt.");
    }

    return {
      accept: "application/vnd.linkedin.normalized+json+2.1",
      "accept-language": "en-US,en;q=0.9",
      "csrf-token": csrfToken,
      origin: LINKEDIN_ORIGIN,
      referer: options?.referer ?? LINKEDIN_FEED,
      "user-agent": LINKEDIN_USER_AGENT,
      "x-li-lang": "en_US",
      "x-requested-with": "XMLHttpRequest",
      "x-restli-protocol-version": "2.0.0",
      ...(options?.json ? { "content-type": "application/json; charset=UTF-8" } : {}),
    };
  }

  private async buildLinkedInCommentHeaders(
    client: Awaited<ReturnType<LinkedInAdapter["createLinkedInClient"]>>,
    referer: string,
  ): Promise<Record<string, string>> {
    return {
      ...(await this.buildLinkedInHeaders(client, { json: true, referer })),
      "x-li-deco-include-micro-schema": "true",
      "x-li-page-instance": `urn:li:page:d_flagship3_feed;${randomBytes(16).toString("base64url")}`,
      "x-li-pem-metadata": "Voyager - Feed - Comments=create-a-comment",
    };
  }

  private buildPostPayload(text: string): Record<string, unknown> {
    return {
      visibleToConnectionsOnly: false,
      externalAudienceProviderUnion: {
        externalAudienceProvider: "LINKEDIN",
      },
      commentaryV2: {
        text,
        attributes: [],
      },
      origin: "FEED",
      allowedCommentersScope: "ALL",
      postState: "PUBLISHED",
    };
  }

  private buildReactionPayloads(entityUrns: string[], memberUrn?: string): Array<Record<string, unknown>> {
    const payloads: Array<Record<string, unknown>> = [];

    for (const entityUrn of entityUrns) {
      payloads.push({ entityUrn, reactionType: "LIKE" });
      payloads.push({ objectUrn: entityUrn, reactionType: "LIKE" });
      if (memberUrn) {
        payloads.push({ actor: memberUrn, entityUrn, reactionType: "LIKE" });
      }
    }

    return dedupePayloads(payloads);
  }

  private buildCommentPayloads(entityUrns: string[], text: string, memberUrn?: string): Array<Record<string, unknown>> {
    const payloads: Array<Record<string, unknown>> = [];

    for (const entityUrn of entityUrns) {
      payloads.push({
        object: entityUrn,
        message: { text },
      });
      payloads.push({
        objectUrn: entityUrn,
        message: { text },
      });
      payloads.push({
        object: entityUrn,
        commentary: { text },
      });
      if (memberUrn) {
        payloads.push({
          actor: memberUrn,
          object: entityUrn,
          message: { text },
        });
      }
    }

    return dedupePayloads(payloads);
  }

  private extractUser(response: LinkedInMeResponse): SessionUser | undefined {
    const username = response.miniProfile?.publicIdentifier;
    const firstName = response.miniProfile?.firstName ?? this.getLocalizedValue(response.firstName);
    const lastName = response.miniProfile?.lastName ?? this.getLocalizedValue(response.lastName);
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || undefined;
    const id =
      response.plainId ??
      this.extractUrnId(response.entityUrn) ??
      this.extractUrnId(response.miniProfile?.entityUrn);

    if (!id && !username && !displayName) {
      return undefined;
    }

    return {
      id: id ?? undefined,
      username: username ?? undefined,
      displayName,
      profileUrl: username ? `${LINKEDIN_ORIGIN}/in/${username}/` : undefined,
    };
  }

  private getLocalizedValue(field?: LinkedInLocalizedField): string | undefined {
    if (!field?.localized) {
      return undefined;
    }

    const localeKey =
      field.preferredLocale?.language && field.preferredLocale?.country
        ? `${field.preferredLocale.language}_${field.preferredLocale.country}`
        : undefined;

    if (localeKey && field.localized[localeKey]) {
      return field.localized[localeKey];
    }

    return Object.values(field.localized)[0];
  }

  private extractMemberUrn(response: LinkedInMeResponse): string | undefined {
    const direct = response.entityUrn;
    if (direct?.includes(":person:")) {
      return direct;
    }

    const miniProfileUrn = response.miniProfile?.entityUrn;
    if (miniProfileUrn?.includes(":person:")) {
      return miniProfileUrn;
    }

    if (miniProfileUrn?.includes(":fs_miniProfile:")) {
      return miniProfileUrn.replace(":fs_miniProfile:", ":person:");
    }

    if (direct?.includes(":fsd_profile:")) {
      return direct.replace(":fsd_profile:", ":person:");
    }

    return undefined;
  }

  private extractEntityUrn(response: LinkedInEntityResponse | null | undefined): string | undefined {
    if (!response) {
      return undefined;
    }

    if (response.entityUrn) {
      return response.entityUrn;
    }

    if (response.value?.entityUrn) {
      return response.value.entityUrn;
    }

    return response.included?.find((entry) => entry.entityUrn)?.entityUrn;
  }

  private extractCreatePostUrn(response: LinkedInEntityResponse | null | undefined, rawResponse?: Response): string | undefined {
    if (!response) {
      return rawResponse?.headers.get("x-restli-id") ?? undefined;
    }

    const graphqlResult = response.data?.data?.createContentcreationDashShares;
    const candidates = [
      response.urn,
      response.entityUrn,
      response.data?.urn,
      response.data?.entityUrn,
      response.value?.urn,
      response.value?.entityUrn,
      graphqlResult?.resourceKey,
      graphqlResult?.shareUrn,
      graphqlResult?.entity,
      graphqlResult?.["*entity"],
      rawResponse?.headers.get("x-restli-id") ?? undefined,
    ];

    return candidates.find((value) => typeof value === "string" && value.startsWith("urn:li:"));
  }

  private entityUrnToUrl(entityUrn: string): string {
    return `${LINKEDIN_ORIGIN}/feed/update/${encodeURIComponent(entityUrn)}/`;
  }

  private extractUrnId(value?: string): string | undefined {
    return value?.split(":").pop();
  }

  private extractCsrfToken(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    return value.replace(/^"+|"+$/g, "");
  }

  private normalizeThreadUrn(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value.startsWith("urn:li:fsd_update:")) {
      const inner = value.split("(", 1)[1]?.split(")", 1)[0];
      return inner?.split(",")[0];
    }

    return value;
  }

  private isAuthFailure(error: unknown): boolean {
    if (!isAutoCliError(error)) {
      return false;
    }

    if (error.code === "SESSION_EXPIRED") {
      return true;
    }

    if (error.code !== "HTTP_REQUEST_FAILED") {
      return false;
    }

    const status = typeof error.details?.status === "number" ? error.details.status : undefined;
    return status === 401 || status === 403;
  }

  private async persistSessionState(session: PlatformSession, probe: LinkedInProbe): Promise<void> {
    const jar = await this.cookieManager.createJar(session);
    await this.saveSession({
      account: session.account,
      source: session.source,
      user: probe.user ?? session.user,
      status: probe.status,
      metadata: {
        ...(session.metadata ?? {}),
        ...(probe.metadata ?? {}),
      },
      jar,
      existingSession: session,
    });
  }

  private async tryRequestChain<T>(attempts: Array<() => Promise<T>>, fallbackMessage: string): Promise<T> {
    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }

    if (isAutoCliError(lastError) && lastError.code === "HTTP_REQUEST_FAILED") {
      const status = typeof lastError.details?.status === "number" ? lastError.details.status : undefined;

      if (status === 404) {
        throw new AutoCliError(
          "LINKEDIN_ENDPOINT_CHANGED",
          "LinkedIn's current web write endpoint changed. The LinkedIn adapter needs a refresh before posting/liking/commenting will work reliably.",
          {
            cause: lastError,
            details: lastError.details,
          },
        );
      }
    }

    throw new AutoCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: lastError,
      details:
        isAutoCliError(lastError) && lastError.details
          ? lastError.details
          : lastError instanceof Error
            ? { message: lastError.message }
            : undefined,
    });
  }

  private mapLinkedInWriteError(error: unknown, fallbackMessage: string): AutoCliError {
    if (isAutoCliError(error) && error.code === "HTTP_REQUEST_FAILED") {
      const status = typeof error.details?.status === "number" ? error.details.status : undefined;

      if (status === 404) {
        return new AutoCliError(
          "LINKEDIN_ENDPOINT_CHANGED",
          "LinkedIn's current web write endpoint changed. The LinkedIn adapter needs a refresh before posting/liking/commenting will work reliably.",
          {
            cause: error,
            details: error.details,
          },
        );
      }

      if (status === 401 || status === 403) {
        return new AutoCliError(
          "SESSION_EXPIRED",
          "LinkedIn rejected the saved session for this action. Re-export cookies from an active browser session.",
          {
            cause: error,
            details: error.details,
          },
        );
      }

      if (status === 409) {
        return new AutoCliError(
          "LINKEDIN_POST_CONFLICT",
          "LinkedIn rejected this post with 409 Conflict. This usually means the content is duplicated or otherwise conflicts with a recent post. Change the text and retry.",
          {
            cause: error,
            details: error.details,
          },
        );
      }
    }

    return new AutoCliError("PLATFORM_REQUEST_FAILED", fallbackMessage, {
      cause: error,
      details:
        isAutoCliError(error) && error.details
          ? error.details
          : error instanceof Error
            ? { message: error.message }
            : undefined,
    });
  }

  private async filterLinkedInCookies(sourceJar: CookieJar): Promise<CookieJar> {
    const filteredJar = new CookieJar();
    const domains = [`${LINKEDIN_ORIGIN}/`, LINKEDIN_FEED];

    for (const url of domains) {
      const cookies = await sourceJar.getCookies(url);

      for (const cookie of cookies) {
        if (!LINKEDIN_COOKIE_ALLOWLIST.has(cookie.key)) {
          continue;
        }

        const normalized = Cookie.fromJSON(cookie.toJSON());
        if (!normalized) {
          continue;
        }

        await filteredJar.setCookie(normalized, `https://${cookie.domain}${cookie.path || "/"}`, {
          ignoreError: true,
        });
      }
    }

    return filteredJar;
  }
}

function dedupePayloads(payloads: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const results: Array<Record<string, unknown>> = [];

  for (const payload of payloads) {
    const key = JSON.stringify(payload);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(payload);
  }

  return results;
}

function buildLinkedInTrackHeader(): string {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  const timezone = resolved.timeZone ?? "UTC";

  return JSON.stringify({
    clientVersion: "1.13.8735",
    mpVersion: "1.13.8735",
    osName: "web",
    timezoneOffset: -new Date().getTimezoneOffset() / 60,
    timezone,
    deviceFormFactor: "DESKTOP",
    mpName: "voyager-web",
    displayDensity: 2,
    displayWidth: 1440,
    displayHeight: 900,
  });
}
