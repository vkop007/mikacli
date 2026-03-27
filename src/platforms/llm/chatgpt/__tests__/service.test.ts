import { describe, expect, test } from "bun:test";

import {
  buildChatGptAuthenticatedConversationPrepareBody,
  buildChatGptAuthenticatedTextConversationBody,
  buildChatGptCloudflareOneShotUrl,
  extractChatGptCloudflareChallengePath,
  extractChatGptCloudflareRequestId,
  generateFakeSentinelToken,
  parseChatGptConversationStream,
  solveChatGptSentinelChallenge,
} from "../service.js";

describe("chatgpt service helpers", () => {
  test("generates a browserless sentinel token", () => {
    const token = generateFakeSentinelToken();
    expect(token.startsWith("gAAAAAC")).toBe(true);
    expect(token.length).toBeGreaterThan(40);
  });

  test("solves an easy sentinel proof-of-work challenge", () => {
    const token = solveChatGptSentinelChallenge("seed", "ffff");
    expect(token.startsWith("gAAAAAB")).toBe(true);
    expect(token.length).toBeGreaterThan(20);
  });

  test("parses assistant output from the event stream", () => {
    const parsed = parseChatGptConversationStream(`
event: delta_encoding
data: "v1"

event: delta
data: {"p":"","o":"add","v":{"message":{"id":"sys-1","author":{"role":"system"},"content":{"content_type":"text","parts":[""]},"status":"finished_successfully","metadata":{}},"conversation_id":"conv-123","error":null,"error_code":null},"c":0}

event: delta
data: {"v":{"message":{"id":"assistant-123","author":{"role":"assistant"},"content":{"content_type":"text","parts":["Hello"]},"status":"in_progress","metadata":{"resolved_model_slug":"i-mini"}},"conversation_id":"conv-123"}}

event: delta
data: {"o":"append","p":"/message/content/parts/0","v":" world"}

data: {"message":{"id":"assistant-123","author":{"role":"assistant"},"content":{"content_type":"text","parts":["Hello world"]},"status":"finished_successfully","metadata":{"resolved_model_slug":"i-mini"}},"conversation_id":"conv-123"}
    `);

    expect(parsed).toEqual({
      outputText: "Hello world",
      conversationId: "conv-123",
      assistantMessageId: "assistant-123",
      model: "i-mini",
    });
  });

  test("builds the authenticated conversation prepare payload", () => {
    const payload = buildChatGptAuthenticatedConversationPrepareBody({
      parentMessageId: "client-created-root",
      model: "auto",
    });

    expect(payload.action).toBe("next");
    expect(payload.parent_message_id).toBe("client-created-root");
    expect(payload.model).toBe("auto");
    expect(payload.history_and_training_disabled).toBe(true);
    expect(payload.paragen_cot_summary_display_override).toBe("allow");
    expect(payload.messages).toBeUndefined();
    expect(payload.client_contextual_info).toEqual({
      is_dark_mode: true,
      time_since_loaded: 7,
      page_height: 911,
      page_width: 1080,
      pixel_ratio: 1,
      screen_height: 1080,
      screen_width: 1920,
      app_name: "chatgpt.com",
    });
  });

  test("builds the authenticated conversation body with snake_case fields", () => {
    const payload = buildChatGptAuthenticatedTextConversationBody({
      prompt: "Hello from AutoCLI",
      model: "auto",
      parentMessageId: "client-created-root",
    });

    expect(payload.action).toBe("next");
    expect(payload.parent_message_id).toBe("client-created-root");
    expect(payload.history_and_training_disabled).toBe(true);
    expect(payload.paragen_cot_summary_display_override).toBe("allow");
    expect(payload.client_contextual_info).toEqual({
      is_dark_mode: true,
      time_since_loaded: 7,
      page_height: 911,
      page_width: 1080,
      pixel_ratio: 1,
      screen_height: 1080,
      screen_width: 1920,
      app_name: "chatgpt.com",
    });

    const message = Array.isArray(payload.messages) ? payload.messages[0] : undefined;
    expect(message).toBeDefined();
    expect(message).toMatchObject({
      author: {
        role: "user",
      },
      content: {
        content_type: "text",
        parts: ["Hello from AutoCLI"],
      },
      metadata: {
        serialization_metadata: {
          custom_symbol_offsets: [],
        },
      },
    });
  });

  test("extracts the Cloudflare request id from the ChatGPT HTML shell", () => {
    const html = `
      <script>
        window.__CF$cv$params={r:'9e2b805c7858b7e9',t:'MTc3NDU4NDE2NQ=='};
      </script>
    `;

    expect(extractChatGptCloudflareRequestId(html)).toBe("9e2b805c7858b7e9");
  });

  test("extracts the Cloudflare oneshot challenge path from the jsd script", () => {
    const script = `
      some-obfuscated-prefix
      /jsd/oneshot/ea2d291c0fdc/0.36707159097325237:1774424211:9_pSV23kWGmNtldQToc5YDBzJFUfKD8QS_h75YB-Zx0/
      trailing-obfuscated-code
    `;

    expect(extractChatGptCloudflareChallengePath(script)).toBe(
      "/jsd/oneshot/ea2d291c0fdc/0.36707159097325237:1774424211:9_pSV23kWGmNtldQToc5YDBzJFUfKD8QS_h75YB-Zx0/",
    );
  });

  test("builds the Cloudflare oneshot url from request id and challenge path", () => {
    expect(
      buildChatGptCloudflareOneShotUrl(
        "9e2b805c7858b7e9",
        "/jsd/oneshot/ea2d291c0fdc/0.36707159097325237:1774424211:9_pSV23kWGmNtldQToc5YDBzJFUfKD8QS_h75YB-Zx0/",
      ),
    ).toBe(
      "https://chatgpt.com/cdn-cgi/challenge-platform/h/g/jsd/oneshot/ea2d291c0fdc/0.36707159097325237:1774424211:9_pSV23kWGmNtldQToc5YDBzJFUfKD8QS_h75YB-Zx0/9e2b805c7858b7e9",
    );
  });
});
