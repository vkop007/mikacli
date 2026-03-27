import { describe, expect, test } from "bun:test";

import {
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
