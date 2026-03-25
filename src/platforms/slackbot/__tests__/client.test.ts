import { describe, expect, test } from "bun:test";

import { createSlackbotCommand } from "../../../commands/slackbot.js";
import { SlackbotClient } from "../client.js";

function createFetchMock(
  responses: Array<{
    body: unknown;
    status?: number;
    headers?: Record<string, string>;
  }>,
): {
  fetchImpl: any;
  calls: Array<{ url: string; body: string; headers: HeadersInit }>;
} {
  const calls: Array<{ url: string; body: string; headers: HeadersInit }> = [];

  const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
    const next = responses.shift();
    if (!next) {
      throw new Error(`Unexpected Slack API call to ${String(url)}`);
    }

    const body = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? "");
    calls.push({
      url: String(url),
      body,
      headers: init?.headers ?? {},
    });

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: next.headers,
    });
  };

  return { fetchImpl, calls };
}

function createConnectionStoreMock(token = "xoxb-test-token") {
  const saveCalls: Array<Record<string, unknown>> = [];
  const loadCalls: Array<Record<string, unknown>> = [];
  const connection = {
    version: 1 as const,
    platform: "slackbot" as const,
    account: "default",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    auth: {
      kind: "botToken" as const,
      provider: "slack",
      token,
    },
    status: {
      state: "active" as const,
      message: "Saved.",
    },
    metadata: {},
  };

  return {
    saveCalls,
    loadCalls,
    connection,
    store: {
      async saveBotTokenConnection(input: Record<string, unknown>): Promise<string> {
        saveCalls.push(input);
        connection.account = String(input.account ?? connection.account);
        connection.updatedAt = new Date().toISOString();
        connection.auth = {
          kind: "botToken",
          provider: String(input.provider ?? "slack"),
          token: String(input.token),
        };
        connection.status = (input.status as typeof connection.status) ?? connection.status;
        connection.metadata = (input.metadata as Record<string, unknown> | undefined) ?? connection.metadata;
        return `/tmp/${connection.account}.json`;
      },
      async loadBotTokenConnection(platform: string, account?: string): Promise<any> {
        loadCalls.push({ platform, account });
        return {
          connection,
          path: `/tmp/${account ?? connection.account}.json`,
          auth: connection.auth,
        };
      },
    },
  };
}

describe("slackbot command tree", () => {
  test("registers the expected commands", () => {
    const command = createSlackbotCommand();
    expect(command.commands.map((subcommand) => subcommand.name())).toEqual(
      expect.arrayContaining(["login", "me", "channels", "history", "send", "send-file", "edit", "delete"]),
    );
  });
});

describe("SlackbotClient", () => {
  test("saves bot token connections during login", async () => {
    const fetchMock = createFetchMock([
      {
        body: {
          ok: true,
          team: "Acme",
          team_id: "T123",
          user: "build-bot",
          user_id: "U123",
          bot_name: "Build Bot",
          bot_user_id: "U123",
          url: "https://acme.slack.com/",
        },
      },
      {
        body: {
          ok: true,
          user: {
            id: "U123",
            name: "build-bot",
            real_name: "Build Bot",
            profile: {
              display_name: "Build Bot",
              real_name: "Build Bot",
            },
          },
        },
      },
    ]);
    const connectionStore = createConnectionStoreMock();
    const client = new SlackbotClient({
      fetchImpl: fetchMock.fetchImpl,
      connectionStore: connectionStore.store,
    });

    const result = await client.login({
      token: "xoxb-login-token",
      account: "ops",
    });

    expect(connectionStore.saveCalls.length).toBe(1);
    expect(connectionStore.saveCalls[0]).toMatchObject({
      platform: "slackbot",
      account: "ops",
      token: "xoxb-login-token",
      status: {
        state: "active",
      },
    });
    expect(result.sessionPath).toBe("/tmp/ops.json");
    expect(result.message).toContain("Saved Slack access");
  });

  test("loads bot token connections during auth test", async () => {
    const fetchMock = createFetchMock([
      {
        body: {
          ok: true,
          team: "Acme",
          team_id: "T123",
          user: "build-bot",
          user_id: "U123",
          bot_name: "Build Bot",
          bot_user_id: "U123",
          url: "https://acme.slack.com/",
        },
      },
      {
        body: {
          ok: true,
          user: {
            id: "U123",
            name: "build-bot",
            real_name: "Build Bot",
            profile: {
              display_name: "Build Bot",
              real_name: "Build Bot",
            },
          },
        },
      },
    ]);
    const connectionStore = createConnectionStoreMock();
    const client = new SlackbotClient({
      fetchImpl: fetchMock.fetchImpl,
      connectionStore: connectionStore.store,
    });

    const result = await client.authTest({ account: "ops" });

    expect(connectionStore.loadCalls[0]).toEqual({
      platform: "slackbot",
      account: "ops",
    });
    expect(connectionStore.saveCalls.length).toBe(1);
    expect(result.action).toBe("auth-test");
    expect(result.user?.username).toBe("Build Bot");
  });

  test("lists channels and paginates through conversations.list", async () => {
    const fetchMock = createFetchMock([
      {
        body: {
          ok: true,
          channels: [
            {
              id: "C222",
              name: "random",
              is_private: false,
              is_archived: false,
              num_members: 8,
            },
          ],
          response_metadata: {
            next_cursor: "next",
          },
        },
      },
      {
        body: {
          ok: true,
          channels: [
            {
              id: "C111",
              name: "general",
              is_private: false,
              is_archived: false,
              num_members: 12,
            },
          ],
          response_metadata: {
            next_cursor: "",
          },
        },
      },
    ]);
    const connectionStore = createConnectionStoreMock();
    const client = new SlackbotClient({
      fetchImpl: fetchMock.fetchImpl,
      connectionStore: connectionStore.store,
    });

    const channels = await client.listChannels({ account: "ops" });
    expect(channels.channels.map((channel) => channel.name)).toEqual(["general", "random"]);
  });

  test("resolves channel names for sendMessage", async () => {
    const fetchMock = createFetchMock([
      {
        body: {
          ok: true,
          channels: [
            {
              id: "C111",
              name: "general",
              is_private: false,
              is_archived: false,
              num_members: 12,
            },
          ],
          response_metadata: {
            next_cursor: "",
          },
        },
      },
      {
        body: {
          ok: true,
          channel: "C111",
          ts: "1700000000.123456",
          message: {
            text: "hello slack",
          },
        },
      },
      {
        body: {
          ok: true,
          permalink: "https://acme.slack.com/archives/C111/p1700000000123456",
        },
      },
    ]);
    const connectionStore = createConnectionStoreMock();
    const client = new SlackbotClient({
      fetchImpl: fetchMock.fetchImpl,
      connectionStore: connectionStore.store,
    });

    const result = await client.sendMessage({
      account: "ops",
      channel: "#general",
      text: "hello slack",
    });

    expect(fetchMock.calls.map((call) => call.url)).toEqual([
      "https://slack.com/api/conversations.list",
      "https://slack.com/api/chat.postMessage",
      "https://slack.com/api/chat.getPermalink",
    ]);
    expect(new URLSearchParams(fetchMock.calls[1]?.body).get("channel")).toBe("C111");
    expect(new URLSearchParams(fetchMock.calls[1]?.body).get("text")).toBe("hello slack");
    expect(result.url).toContain("p1700000000123456");
  });
});
