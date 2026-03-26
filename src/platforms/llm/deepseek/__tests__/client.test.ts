import { describe, expect, test } from "bun:test";
import { CookieJar } from "tough-cookie";

import { AutoCliError } from "../../../../errors.js";
import { SessionHttpClient } from "../../../../utils/http-client.js";
import {
  extractDeepSeekAuthToken,
  mapDeepSeekError,
  normalizeDeepSeekAuthToken,
  parseDeepSeekCompletionStream,
} from "../client.js";
import { encodeDeepSeekPowResponse } from "../pow.js";

describe("deepseek client helpers", () => {
  test("normalizes bearer token input", () => {
    expect(normalizeDeepSeekAuthToken("Bearer auth-token")).toBe("auth-token");
    expect(normalizeDeepSeekAuthToken("auth-token")).toBe("auth-token");
  });

  test("extracts an auth token from a cookie-backed session", async () => {
    const jar = new CookieJar();
    await jar.setCookie("auth_token=abc123; Domain=chat.deepseek.com; Path=/; Secure", "https://chat.deepseek.com/");
    const client = new SessionHttpClient(jar);

    await expect(extractDeepSeekAuthToken(client)).resolves.toBe("abc123");
  });

  test("encodes the PoW response payload as base64 JSON", () => {
    const encoded = encodeDeepSeekPowResponse(
      {
        algorithm: "DeepSeekHashV1",
        challenge: "challenge",
        salt: "salt",
        difficulty: 12,
        expire_at: 123456,
        signature: "signature",
        target_path: "/api/v0/chat/completion",
      },
      42,
    );

    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, unknown>;
    expect(decoded).toEqual({
      algorithm: "DeepSeekHashV1",
      challenge: "challenge",
      salt: "salt",
      answer: 42,
      signature: "signature",
      target_path: "/api/v0/chat/completion",
    });
  });

  test("parses streamed completion fragments", () => {
    const parsed = parseDeepSeekCompletionStream(`
data: {"v":{"response":{"message_id":17,"parent_id":1,"model":"deepseek-chat","role":"ASSISTANT","content":"","thinking_content":null}}}

data: {"p":"response/content","o":"APPEND","v":"Hello"}

data: {"p":"response/thinking_content","o":"APPEND","v":" thinking"}

data: {"p":"response/content","o":"APPEND","v":" world"}

data: {"p":"response/status","v":"FINISHED"}
    `);

    expect(parsed.outputText).toBe("Hello world");
    expect(parsed.thinkingText).toEqual([" thinking"]);
    expect(parsed.messageId).toBe("17");
    expect(parsed.model).toBe("deepseek-chat");
  });

  test("maps missing-token responses to expired sessions", () => {
    const mapped = mapDeepSeekError(
      new AutoCliError("DEEPSEEK_API_REQUEST_FAILED", "Missing Token", {
        details: {
          code: 40002,
        },
      }),
      "fallback",
    );

    expect(mapped.code).toBe("DEEPSEEK_SESSION_EXPIRED");
  });
});
