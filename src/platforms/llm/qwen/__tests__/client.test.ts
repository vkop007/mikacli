import { describe, expect, test } from "bun:test";
import { CookieJar } from "tough-cookie";

import { MikaCliError } from "../../../../errors.js";
import { SessionHttpClient } from "../../../../utils/http-client.js";
import { extractQwenAuthToken, mapQwenError, normalizeQwenAuthToken, parseQwenCompletionStream } from "../client.js";

describe("qwen client helpers", () => {
  test("normalizes bearer token input", () => {
    expect(normalizeQwenAuthToken("Bearer qwen-token")).toBe("qwen-token");
    expect(normalizeQwenAuthToken("qwen-token")).toBe("qwen-token");
  });

  test("extracts auth token from cookie-backed session", async () => {
    const jar = new CookieJar();
    await jar.setCookie("token=abc123; Domain=chat.qwen.ai; Path=/; Secure", "https://chat.qwen.ai/");
    const client = new SessionHttpClient(jar);

    await expect(extractQwenAuthToken(client)).resolves.toBe("abc123");
  });

  test("parses streamed completion fragments and search results", () => {
    const parsed = parseQwenCompletionStream(`
data: {"choices":[{"delta":{"content":"Hello"}}],"model":"qwen-max-latest"}

data: {"choices":[{"delta":{"extra":{"web_search_info":[{"url":"https://example.com","title":"Example","snippet":"Snippet"}]}}}]}

data: {"choices":[{"delta":{"content":" world"}}]}
    `);

    expect(parsed.outputText).toBe("Hello world");
    expect(parsed.model).toBe("qwen-max-latest");
    expect(parsed.searchResults).toEqual([
      {
        url: "https://example.com",
        title: "Example",
        snippet: "Snippet",
        hostname: undefined,
        date: undefined,
      },
    ]);
  });

  test("maps missing-token responses to expired sessions", () => {
    const mapped = mapQwenError(
      new MikaCliError("QWEN_AUTH_TOKEN_MISSING", "missing token"),
      "fallback",
    );

    expect(mapped.code).toBe("QWEN_SESSION_EXPIRED");
  });
});
