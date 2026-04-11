import { describe, expect, test } from "bun:test";

import { CalendarAdapter } from "../calendar/adapter.js";
import { calendarPlatformDefinition } from "../calendar/manifest.js";
import { DriveAdapter } from "../drive/adapter.js";
import { drivePlatformDefinition } from "../drive/manifest.js";
import { GmailAdapter } from "../gmail/adapter.js";
import { gmailPlatformDefinition } from "../gmail/manifest.js";
import { sheetsPlatformDefinition } from "../sheets/manifest.js";

function createConnectionStoreMock() {
  const saveCalls: Array<Record<string, unknown>> = [];
  let savedAuth: Record<string, unknown> = {
    kind: "oauth2",
    provider: "google",
    clientId: "google-client-id-example",
    clientSecret: "google-client-secret-example",
    refreshToken: "google-refresh-token-example",
    accessToken: "google-access-token-example",
    expiresAt: "2099-01-01T00:00:00.000Z",
    scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"],
  };
  let savedUser: Record<string, unknown> | undefined;
  let savedStatus: Record<string, unknown> = {
    state: "active",
    message: "Saved.",
    lastValidatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  };
  let savedMetadata: Record<string, unknown> | undefined;

  return {
    saveCalls,
    store: {
      async saveOAuth2Connection(input: Record<string, unknown>): Promise<string> {
        saveCalls.push(input);
        savedAuth = {
          kind: "oauth2",
          provider: input.provider ?? "google",
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          refreshToken: input.refreshToken,
          accessToken: input.accessToken,
          expiresAt: input.expiresAt,
          tokenType: input.tokenType,
          scopes: input.scopes,
        };
        savedUser = input.user as Record<string, unknown> | undefined;
        savedStatus = input.status as Record<string, unknown>;
        savedMetadata = input.metadata as Record<string, unknown> | undefined;
        return "/tmp/google-default.json";
      },
      async loadOAuth2Connection(): Promise<any> {
        return {
          path: "/tmp/google-default.json",
          auth: savedAuth,
          connection: {
            version: 1,
            platform: "gmail",
            account: "default",
            createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            auth: savedAuth,
            user: savedUser,
            status: savedStatus,
            metadata: savedMetadata,
          },
        };
      },
    },
  };
}

function createFetchMock(
  responses: Array<{
    body: unknown;
    status?: number;
  }>,
): typeof fetch {
  return (async () => {
    const next = responses.shift();
    if (!next) {
      throw new Error("Unexpected fetch call.");
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as unknown as typeof fetch;
}

describe("google provider command trees", () => {
  test("calendar exposes the expected commands", () => {
    const command = calendarPlatformDefinition.buildCommand?.();
    expect(command?.commands.map((item) => item.name())).toEqual(
      expect.arrayContaining(["auth-url", "login", "status", "me", "calendars", "calendar", "events", "today", "event", "create-event", "update-event", "delete-event"]),
    );
  });

  test("gmail exposes the expected commands", () => {
    const command = gmailPlatformDefinition.buildCommand?.();
    expect(command?.commands.map((item) => item.name())).toEqual(
      expect.arrayContaining(["auth-url", "login", "status", "me", "labels", "messages", "message", "send"]),
    );
  });

  test("drive exposes the expected commands", () => {
    const command = drivePlatformDefinition.buildCommand?.();
    expect(command?.commands.map((item) => item.name())).toEqual(
      expect.arrayContaining(["auth-url", "login", "status", "me", "files", "file", "create-folder", "upload", "download", "delete"]),
    );
  });

  test("sheets exposes the expected commands", () => {
    const command = sheetsPlatformDefinition.buildCommand?.();
    expect(command?.commands.map((item) => item.name())).toEqual(
      expect.arrayContaining(["auth-url", "login", "status", "me", "create", "spreadsheet", "values", "append", "update", "clear"]),
    );
  });
});

describe("google adapter flows", () => {
  test("calendar calendars lists saved calendars from an active oauth connection", async () => {
    const connectionStore = createConnectionStoreMock();
    const adapter = new CalendarAdapter({
      connectionStore: connectionStore.store as any,
      fetchImpl: createFetchMock([
        {
          body: {
            sub: "google-user-id-example",
            email: "person@example.com",
            email_verified: true,
            name: "Example Person",
          },
        },
        {
          body: {
            items: [
              {
                id: "primary",
                summary: "Work",
                primary: true,
                accessRole: "owner",
                timeZone: "Asia/Kolkata",
              },
            ],
          },
        },
      ]),
    });

    const result = await adapter.calendars({ account: "default", limit: 10 });

    expect(result.data?.calendars).toEqual([
      expect.objectContaining({
        id: "primary",
        summary: "Work",
        primary: true,
      }),
    ]);
    expect(connectionStore.saveCalls.length).toBe(1);
  });

  test("gmail login saves an oauth2 connection with refresh credentials", async () => {
    const connectionStore = createConnectionStoreMock();
    const adapter = new GmailAdapter({
      connectionStore: connectionStore.store as any,
      fetchImpl: createFetchMock([
        {
          body: {
            access_token: "google-access-token-example",
            refresh_token: "google-refresh-token-example",
            expires_in: 3600,
            scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
            token_type: "Bearer",
          },
        },
        {
          body: {
            sub: "google-user-id-example",
            email: "person@example.com",
            email_verified: true,
            name: "Example Person",
          },
        },
      ]),
    });

    const result = await adapter.login({
      account: "work",
      clientId: "google-client-id-example",
      clientSecret: "google-client-secret-example",
      code: "google-auth-code-example",
      redirectUri: "http://127.0.0.1:3333/callback",
    });

    expect(connectionStore.saveCalls.length).toBe(1);
    expect(connectionStore.saveCalls[0]).toMatchObject({
      platform: "gmail",
      account: "work",
      refreshToken: "google-refresh-token-example",
      accessToken: "google-access-token-example",
      status: {
        state: "active",
      },
    });
    expect(result.user?.username).toBe("person@example.com");
  });

  test("drive status reuses a fresh access token and validates profile data", async () => {
    const connectionStore = createConnectionStoreMock();
    const adapter = new DriveAdapter({
      connectionStore: connectionStore.store as any,
      fetchImpl: createFetchMock([
        {
          body: {
            sub: "google-user-id-example",
            email: "person@example.com",
            email_verified: true,
            name: "Example Person",
          },
        },
      ]),
    });

    const result = await adapter.getStatus("default");

    expect(result.connected).toBe(true);
    expect(result.status).toBe("active");
    expect(connectionStore.saveCalls.length).toBe(1);
  });
});
