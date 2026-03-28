import { describe, expect, test } from "bun:test";

import { listSessionEntries, loadSessionEntry } from "../commands/sessions.js";

describe("sessions command helpers", () => {
  test("maps saved connections into session entries", async () => {
    const fakeStore = {
      async listConnections() {
        return [
          {
            connection: {
              version: 1 as const,
              platform: "github" as const,
              account: "work",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
              auth: {
                kind: "apiKey" as const,
                provider: "github",
                token: "secret",
              },
              status: {
                state: "active" as const,
                message: "GitHub token validated.",
                lastValidatedAt: "2026-01-02T00:00:00.000Z",
              },
              user: {
                username: "vk",
              },
            },
            path: "/tmp/github-work.json",
          },
        ];
      },
    };

    const entries = await listSessionEntries(fakeStore as never);
    expect(entries).toEqual([
      {
        platform: "github",
        displayName: "GitHub",
        account: "work",
        auth: "apiKey",
        source: "github",
        status: "active",
        message: "GitHub token validated.",
        user: "vk",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        lastValidatedAt: "2026-01-02T00:00:00.000Z",
        path: "/tmp/github-work.json",
        metadata: undefined,
      },
    ]);
  });

  test("loads a single saved record", async () => {
    const fakeStore = {
      async loadConnection() {
        return {
          connection: {
            version: 1 as const,
            platform: "x" as const,
            account: "default",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            auth: {
              kind: "cookies" as const,
              source: "cookie_json" as const,
            },
            status: {
              state: "expired" as const,
              message: "Session expired.",
            },
          },
          path: "/tmp/x-default.json",
        };
      },
    };

    const entry = await loadSessionEntry("x", "default", fakeStore as never);
    expect(entry.platform).toBe("x");
    expect(entry.auth).toBe("cookies");
    expect(entry.source).toBe("cookie_json");
    expect(entry.status).toBe("expired");
    expect(entry.path).toBe("/tmp/x-default.json");
  });
});
