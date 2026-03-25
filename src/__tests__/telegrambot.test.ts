import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { TelegramBotApi } from "../platforms/telegrambot/api.js";
import { TelegramBotAdapter } from "../platforms/telegrambot/adapter.js";

const TEST_BOT = {
  id: 42,
  is_bot: true,
  first_name: "AutoCLI",
  username: "autocli_bot",
};

afterEach(() => {
  // Nothing global to clean up yet, but the hook keeps the file ready for future mocks.
});

describe("TelegramBotApi", () => {
  test("uploads local media files as multipart form data", async () => {
    const dir = mkdtempSync(join(tmpdir(), "autocli-telegram-"));
    const filePath = join(dir, "photo.txt");
    writeFileSync(filePath, "hello world");

    let capturedBody: BodyInit | null | undefined;
    const api = new TelegramBotApi("test-token", async (input, init) => {
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            message_id: 7,
            date: 1,
            chat: { id: 99, type: "private" },
          },
        }),
        { status: 200 },
      );
    });

    try {
      const result = await api.sendPhoto({
        chatId: 99,
        media: filePath,
        caption: "Hello",
      });

      expect(result.message_id).toBe(7);
      expect(capturedBody).toBeInstanceOf(FormData);
      const form = capturedBody as FormData;
      expect(form.get("caption")).toBe("Hello");
      const photo = form.get("photo");
      expect(photo).toBeInstanceOf(File);
      expect((photo as File).name).toBe("photo.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("TelegramBotAdapter", () => {
  test("saves bot token connections through the shared token connection store", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const adapter = new TelegramBotAdapter({
      connectionStore: {
        saveBotTokenConnection: async (input) => {
          saved.push(input as Record<string, unknown>);
          return "/tmp/telegrambot.json";
        },
        loadBotTokenConnection: async () => {
          throw new Error("loadBotTokenConnection should not be called in this test");
        },
      },
      createApi: () =>
        ({
          getMe: async () => TEST_BOT,
        }) as never,
    });

    const result = await adapter.login({
      token: "123:abc",
      account: "demo",
    });

    expect(result.account).toBe("demo");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.platform).toBe("telegrambot");
    expect(saved[0]?.token).toBe("123:abc");
    expect(saved[0]?.status && typeof saved[0].status === "object" ? (saved[0].status as { state?: string }).state : undefined).toBe("active");
  });

  test("loads bot token connections for subsequent status checks", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const adapter = new TelegramBotAdapter({
      connectionStore: {
        saveBotTokenConnection: async (input) => {
          saved.push(input as Record<string, unknown>);
          return "/tmp/telegrambot.json";
        },
        loadBotTokenConnection: async () => ({
          connection: {
            version: 1,
            platform: "telegrambot",
            account: "demo",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            auth: {
              kind: "botToken",
              provider: "telegram",
              token: "123:abc",
            },
            status: {
              state: "unknown",
            },
          },
          path: "/tmp/telegrambot.json",
          auth: {
            kind: "botToken",
            provider: "telegram",
            token: "123:abc",
          },
        }),
      },
      createApi: () =>
        ({
          getMe: async () => TEST_BOT,
        }) as never,
    });

    const status = await adapter.getStatus("demo");

    expect(status.connected).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.status && typeof saved[0].status === "object" ? (saved[0].status as { state?: string }).state : undefined).toBe("active");
  });
});

